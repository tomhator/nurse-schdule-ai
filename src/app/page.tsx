'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getNurses, saveMonthlySchedulesToNurses } from './nurse/action';
import { getTotalStaffing, getStaffingRequirements } from './staffing/action';
import { optimizeSchedule, ScheduleConstraints, Nurse } from './schedule-optimizer';
// import { 
//   saveSchedule, 
//   loadSchedule, 
//   resetSchedule, 
//   calculateMinDaysOff, 
//   calculateNurseOffDays, 
//   calculateRemainingOff 
// } from './action';

export default function Home() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [requiredStaff, setRequiredStaff] = useState(3);
  const [scheduleData, setScheduleData] = useState<{[year: number]: {[month: number]: {[key: string]: string}}}>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [shortageData, setShortageData] = useState<{[day: number]: number}>({});
  const [totalRequiredStaffing, setTotalRequiredStaffing] = useState<number>(0);
  const [nurses, setNurses] = useState<any[]>([]);

  // 간호사 데이터 불러오기
  useEffect(() => {
    const loadNurses = () => {
      const nursesData = getNurses();
      setNurses(nursesData);
    };
    loadNurses();
  }, []);

  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  // 해당 월의 날짜 배열 생성
  const getDaysInMonth = (year: number, month: number) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  };

  // 주말 체크 (토요일: 6, 일요일: 0)
  const isWeekend = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  // 공휴일 체크 (간단한 예시)
  const isHoliday = (year: number, month: number, day: number) => {
    // 2024년 공휴일 예시
    const holidays = [
      `${year}-01-01`, // 신정
      `${year}-03-01`, // 삼일절
      `${year}-05-05`, // 어린이날
      `${year}-06-06`, // 현충일
      `${year}-08-15`, // 광복절
      `${year}-10-03`, // 개천절
      `${year}-10-09`, // 한글날
      `${year}-12-25`, // 성탄절
    ];
    
    const dateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return holidays.includes(dateString);
  };

  // 날짜가 주말이거나 공휴일인지 체크
  const isWeekendOrHoliday = (year: number, month: number, day: number) => {
    return isWeekend(year, month, day) || isHoliday(year, month, day);
  };

  // 근무 상태 옵션
  const workStatusOptions = [
    { value: '-', label: '-', color: 'text-gray-500' },
    { value: 'D', label: 'D (주간)', color: 'text-blue-600' },
    { value: 'E', label: 'E (저녁)', color: 'text-orange-600' },
    { value: 'N', label: 'N (야간)', color: 'text-purple-600' },
    { value: 'M', label: 'M (오전)', color: 'text-green-600' },
    { value: 'O', label: 'O (휴무)', color: 'text-red-600' }
  ];

  // 근무 상태 업데이트
  const updateSchedule = (nurseId: number, day: number, status: string) => {
    const key = `${nurseId}-${day}`;
    setScheduleData(prev => ({
      ...prev,
      [currentYear]: {
        ...prev[currentYear],
        [currentMonth]: {
          ...prev[currentYear]?.[currentMonth],
          [key]: status
        }
      }
    }));
    setActiveDropdown(null);
  };

  // 드롭다운 토글
  const toggleDropdown = (nurseId: number, day: number) => {
    const key = `${nurseId}-${day}`;
    setActiveDropdown(activeDropdown === key ? null : key);
  };

  // 현재 근무 상태 가져오기
  const getCurrentStatus = (nurseId: number, day: number) => {
    const key = `${nurseId}-${day}`;
    return scheduleData[currentYear]?.[currentMonth]?.[key] || '-';
  };

  // 최소 휴무일 계산 (주말 + 공휴일)
  const calculateMinDaysOff = (year: number, month: number) => {
    const daysInMonth = getDaysInMonth(year, month);
    let weekendHolidayCount = 0;
    
    daysInMonth.forEach(day => {
      if (isWeekendOrHoliday(year, month, day)) {
        weekendHolidayCount++;
      }
    });
    
    return weekendHolidayCount;
  };

  // 각 간호사의 N(야간) 근무 개수 계산
  const calculateNurseNCount = (nurseId: number) => {
    const currentMonthData = scheduleData[currentYear]?.[currentMonth] || {};
    let nCount = 0;
    
    getDaysInMonth(currentYear, currentMonth).forEach(day => {
      const key = `${nurseId}-${day}`;
      if (currentMonthData[key] === 'N') {
        nCount++;
      }
    });
    
    return nCount;
  };

  // 각 간호사의 O(휴무) 개수 계산
  const calculateNurseOCount = (nurseId: number) => {
    const currentMonthData = scheduleData[currentYear]?.[currentMonth] || {};
    let oCount = 0;
    
    getDaysInMonth(currentYear, currentMonth).forEach(day => {
      const key = `${nurseId}-${day}`;
      if (currentMonthData[key] === 'O') {
        oCount++;
      }
    });
    
    return oCount;
  };

  // 각 간호사의 O(휴무) 개수 계산
  const calculateNurseOffDays = (nurseId: number) => {
    const currentMonthData = scheduleData[currentYear]?.[currentMonth] || {};
    let offCount = 0;
    
    getDaysInMonth(currentYear, currentMonth).forEach(day => {
      const key = `${nurseId}-${day}`;
      if (currentMonthData[key] === 'O') {
        offCount++;
      }
    });
    
    return offCount;
  };

  // 각 간호사의 남은 off 개수 계산
  const calculateRemainingOff = (nurseId: number) => {
    const minDaysOff = calculateMinDaysOff(currentYear, currentMonth);
    const usedOffDays = calculateNurseOffDays(nurseId);
    const remaining = Math.max(0, minDaysOff - usedOffDays);
    
    return remaining;
  };

  // 특정 날짜의 근무자 수 계산 (O와 - 제외)
  const calculateWorkersCount = (day: number) => {
    let count = 0;
    nurses.forEach(nurse => {
      const key = `${nurse.id}-${day}`;
      const currentMonthData = scheduleData[currentYear]?.[currentMonth] || {};
      const shift = currentMonthData[key];
      if (shift && shift !== 'O' && shift !== '-') {
        count++;
      }
    });
    return count;
  };

  // 각 날짜별 O근무자 수 계산
  const calculateOCount = (day: number) => {
    let count = 0;
    nurses.forEach(nurse => {
      const key = `${nurse.id}-${day}`;
      const currentMonthData = scheduleData[currentYear]?.[currentMonth] || {};
      const shift = currentMonthData[key];
      if (shift === 'O') {
        count++;
      }
    });
    return count;
  };

  // 일일 필수 근무 인원 불러오기
  const getRequiredStaffing = () => {
    return getTotalStaffing();
  };

  // 부족 인원 계산
  const calculateShortage = (day: number) => {
    const currentWorkers = calculateWorkersCount(day);
    const requiredStaffing = getRequiredStaffing();
    const shortage = Math.max(0, requiredStaffing - currentWorkers);
    
    return shortage;
  };

  // 저장된 스케줄 불러오기
  useEffect(() => {
    const loadSavedSchedule = () => {
      const storageKey = `schedule_${currentYear}_${currentMonth}`;
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          setScheduleData(prev => ({
            ...prev,
            [currentYear]: {
              ...prev[currentYear],
              [currentMonth]: parsedData
            }
          }));
        } catch (error) {
          console.error('저장된 스케줄 데이터를 불러오는데 실패했습니다:', error);
        }
      }
    };

    loadSavedSchedule();
  }, [currentYear, currentMonth]);

  // 월이 변경될 때 최소 휴무일 업데이트
  useEffect(() => {
    // 최소 휴무일이 자동으로 계산되어 표시됨
  }, [currentYear, currentMonth]);

  // 스케줄 데이터가 변경될 때 남은 off 재계산
  useEffect(() => {
    // 스케줄 변경 시 자동으로 남은 off가 재계산됨
  }, [scheduleData, currentYear, currentMonth]);

  // 필수 근무 인원 수 불러오기
  useEffect(() => {
    const requiredStaffing = getRequiredStaffing();
    setTotalRequiredStaffing(requiredStaffing);
  }, [currentYear, currentMonth]);

  // 부족 인원 계산
  useEffect(() => {
    const newShortageData: {[day: number]: number} = {};
    
    for (const day of getDaysInMonth(currentYear, currentMonth)) {
      const shortage = calculateShortage(day);
      newShortageData[day] = shortage;
    }
    
    setShortageData(newShortageData);
  }, [scheduleData, currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleScheduleRecommend = () => {
    if (nurses.length === 0) {
      alert('간호사 정보가 없습니다. 먼저 간호사를 등록해주세요.');
      return;
    }

    if (confirm('현재 스케줄을 자동 추천으로 덮어쓰시겠습니까?')) {
      try {
        // 근무 조건 설정 불러오기
        const savedConstraints = localStorage.getItem('work_constraints');
        let workConstraints = {
          maxConsecutiveWorkDays: 4,
          maxConsecutiveOffDays: 3
        };
        
        if (savedConstraints) {
          try {
            workConstraints = JSON.parse(savedConstraints);
          } catch (error) {
            console.error('근무 조건 설정을 불러오는데 실패했습니다:', error);
          }
        }

        // 제약 조건 설정
        console.log('근무 조건 설정:', workConstraints);
        const constraints: ScheduleConstraints = {
          minDaysOff: calculateMinDaysOff(currentYear, currentMonth),
          maxConsecutiveDays: workConstraints.maxConsecutiveWorkDays, // 설정된 최대 연속 근무일
          maxConsecutiveOffDays: workConstraints.maxConsecutiveOffDays, // 설정된 최대 연속 휴무일
          maxNightShifts: 8, // 최대 8회 야간 근무
          weekendWorkRequired: true
        };
        console.log('적용된 제약 조건:', constraints);

        // 필수 인원 요구사항 설정 (staffing 페이지 데이터 사용)
        const staffingRequirements = getStaffingRequirements();

        // 현재 테이블 상태를 2차원 배열로 저장
        const currentScheduleArray = saveCurrentTableToArray(nurses, currentYear, currentMonth, scheduleData);
        console.log('=== 현재 저장된 테이블 2차원 배열 ===');
        console.log(currentScheduleArray);

        // scheduleData를 optimizeSchedule에서 사용할 수 있는 형태로 변환
        const initialSchedule: { [nurseId: number]: { [day: number]: string } } = {};
        nurses.forEach(nurse => {
          initialSchedule[nurse.id] = {};
          const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
          for (let day = 1; day <= daysInMonth; day++) {
            const key = `${nurse.id}-${day}`;
            initialSchedule[nurse.id][day] = scheduleData[currentYear]?.[currentMonth]?.[key] || '-';
          }
        });

        // 스케줄 최적화 실행
        const result = optimizeSchedule(
          nurses,
          currentYear,
          currentMonth,
          staffingRequirements,
          constraints,
          initialSchedule
        );

        // 추천된 스케줄을 현재 스케줄 데이터에 적용 (성공/실패 관계없이)
        const newScheduleData = { ...scheduleData };
        if (!newScheduleData[currentYear]) {
          newScheduleData[currentYear] = {};
        }
        if (!newScheduleData[currentYear][currentMonth]) {
          newScheduleData[currentYear][currentMonth] = {};
        }

        // 간호사별 스케줄을 키-값 형태로 변환
        Object.entries(result.schedule).forEach(([nurseId, nurseSchedule]) => {
          Object.entries(nurseSchedule).forEach(([day, workType]) => {
            const key = `${nurseId}-${day}`;
            newScheduleData[currentYear][currentMonth][key] = workType;
          });
        });

        setScheduleData(newScheduleData);

        if (result.success) {
          alert('스케줄 추천이 완료되었습니다!');
        } else {
          alert(`스케줄이 생성되었지만 일부 제약 조건을 위반했습니다:\n${result.violations.join('\n')}\n\n수동으로 조정해주세요.`);
        }
      } catch (error) {
        alert('스케줄 추천 중 오류가 발생했습니다.');
        console.error('스케줄 추천 오류:', error);
      }
    }
  };

  const handleScheduleReset = () => {
    if (confirm(`${currentYear}년 ${currentMonth}월 스케줄을 초기화하시겠습니까?`)) {
      // 메모리에서 해당 월의 스케줄 데이터 삭제
      setScheduleData(prev => ({
        ...prev,
        [currentYear]: {
          ...prev[currentYear],
          [currentMonth]: {}
        }
      }));
      
      // 로컬 스토리지에서도 해당 월의 스케줄 데이터 삭제
      const storageKey = `schedule_${currentYear}_${currentMonth}`;
      localStorage.removeItem(storageKey);
      
      alert(`${currentYear}년 ${currentMonth}월 스케줄이 초기화되고 저장되었습니다.`);
    }
  };

  const handleScheduleSave = () => {
    const currentMonthData = scheduleData[currentYear]?.[currentMonth] || {};
    const hasData = Object.keys(currentMonthData).length > 0;
    
    if (!hasData) {
      alert('저장할 스케줄 데이터가 없습니다.');
      return;
    }

    // 월별 스케줄 저장 (실제로는 API 호출 또는 로컬 스토리지에 저장)
    console.log(`${currentYear}년 ${currentMonth}월 스케줄 저장:`, currentMonthData);
    
    // 로컬 스토리지에 저장
    const storageKey = `schedule_${currentYear}_${currentMonth}`;
    localStorage.setItem(storageKey, JSON.stringify(currentMonthData));

    // 간호사별 데이터에도 월별 스케줄 반영
    const nurseSyncResult = saveMonthlySchedulesToNurses(currentYear, currentMonth, currentMonthData);
    if (!nurseSyncResult.success) {
      console.warn('간호사별 스케줄 반영 경고:', nurseSyncResult.message);
    }
    
    alert(`${currentYear}년 ${currentMonth}월 스케줄이 저장되었습니다.`);
  };

  // 드롭다운 외부 클릭 시 닫기
  const handleOutsideClick = () => {
    setActiveDropdown(null);
  };

  return (
    <div className="min-h-screen bg-gray-50" onClick={handleOutsideClick}>
      {/* 네비게이션 */}
      <nav className="nav bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 달력 이동 */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                ←
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                {currentYear}년 {monthNames[currentMonth - 1]}
              </h1>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                →
              </button>
            </div>

              {/* 우측 메뉴 */}
              <div className="flex items-center space-x-4">
                <Link 
                  href="/"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  근무표
                </Link>
                <Link 
                  href="/nurse"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  간호사 관리
                </Link>
                <Link 
                  href="/staffing"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  근무 조건 설정
                </Link>
              </div>
          </div>
        </div>
      </nav>

      {/* 메인 바디 */}
      <main className="schedule max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 상단 정보 및 버튼들 */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              {/* 최소휴무일 및 필수 근무 인원 정보 */}
              <div className="flex items-center space-x-6">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">최소휴무일:</span>
                  <span className="ml-2 text-gray-900">{calculateMinDaysOff(currentYear, currentMonth)}일</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">필수 근무 인원:</span>
                  <span className="ml-2 text-gray-900">{totalRequiredStaffing}명</span>
                </div>
              </div>

              {/* 액션 버튼들 */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleScheduleRecommend}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  스케줄 추천
                </button>
                <button
                  onClick={handleScheduleReset}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  스케줄 초기화
                </button>
                <button
                  onClick={handleScheduleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                >
                  스케줄 저장
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 월별 근무표 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {currentYear}년 {monthNames[currentMonth - 1]} 근무표
            </h2>
          </div>
          
          {/* 근무표 그리드 */}
          <div className="p-6">
            <div>
              {/* 날짜 헤더 */}
              <div className="flex items-center gap-1 mb-2">
                <div className="w-32 h-10 flex items-center justify-center text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200">
                  간호사명
                </div>
                {getDaysInMonth(currentYear, currentMonth).map((day) => (
                  <div
                    key={day}
                    className={`w-13 h-10 flex items-center justify-center text-sm font-medium border border-gray-200 ${
                      isWeekendOrHoliday(currentYear, currentMonth, day)
                        ? 'text-red-600 bg-red-50'
                        : 'text-gray-900 bg-white'
                    }`}
                  >
                    {day}
                  </div>
                ))}
                {/* 연차 정보 헤더 */}
                <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200">
                  N개수
                </div>
                <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200">
                  O개수
                </div>
                <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200">
                  남은 off
                </div>
                <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200">
                  사용 연차
                </div>
                <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200">
                  잔여 연차
                </div>
              </div>

              {/* 간호사별 근무표 행 */}
              {nurses
                .sort((a, b) => {
                  // HN > RN > N-RN > AN 순서로 정렬
                  const getSortOrder = (nurse: any) => {
                    if (nurse.position === 'HN') return 1;
                    if (nurse.position === 'RN' && !nurse.nightDedicated) return 2;
                    if (nurse.nightDedicated) return 3;
                    if (nurse.position === 'AN') return 4;
                    return 5;
                  };
                  
                  const orderA = getSortOrder(a);
                  const orderB = getSortOrder(b);
                  
                  if (orderA !== orderB) {
                    return orderA - orderB;
                  }
                  
                  return a.name.localeCompare(b.name);
                })
                .map((nurse) => (
                <div key={nurse.id} className="flex items-center gap-1 mb-1">
                  {/* 간호사 이름 */}
                  <div className="w-32 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200">
                    {nurse.nightDedicated ? `N-${nurse.name}` : nurse.name}
                  </div>
                  
                  {/* 각 날짜별 근무 셀 */}
                  {getDaysInMonth(currentYear, currentMonth).map((day) => {
                    const currentStatus = getCurrentStatus(nurse.id, day);
                    const isDropdownOpen = activeDropdown === `${nurse.id}-${day}`;
                    const statusOption = workStatusOptions.find(option => option.value === currentStatus);
                    
                    return (
                      <div
                        key={day}
                        className={`relative w-13 h-10 border border-gray-200 cursor-pointer hover:bg-blue-50 transition-colors ${
                          isWeekendOrHoliday(currentYear, currentMonth, day)
                            ? 'bg-red-50'
                            : 'bg-white'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDropdown(nurse.id, day);
                        }}
                      >
                        {/* 현재 근무 상태 표시 */}
                        <div className={`w-full h-full flex items-center justify-center text-sm font-medium ${statusOption?.color || 'text-gray-500'}`}>
                          {currentStatus}
        </div>
                        
                        {/* 드롭다운 메뉴 */}
                        {isDropdownOpen && (
                          <div className="absolute top-full left-0 z-[100] mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg">
                            {workStatusOptions.map((option) => (
                              <div
                                key={option.value}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${option.color} ${
                                  currentStatus === option.value ? 'bg-blue-50' : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateSchedule(nurse.id, day, option.value);
                                }}
                              >
                                {option.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* 연차 정보 셀들 */}
                  <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-purple-50 border border-gray-200">
                    {calculateNurseNCount(nurse.id)}
                  </div>
                  <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-yellow-50 border border-gray-200">
                    {calculateNurseOCount(nurse.id)}
                  </div>
                  <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-blue-50 border border-gray-200">
                    {calculateRemainingOff(nurse.id)}
                  </div>
                  <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-orange-50 border border-gray-200">
                    {nurse.usedVacation}
                  </div>
                  <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-green-50 border border-gray-200">
                    {nurse.remainingVacation}
                  </div>
                </div>
              ))}
            </div>

            {/* 근무자 수 합계 행 */}
            <div className="flex items-center gap-1 mb-1">
              {/* 간호사 이름 열 */}
              <div className="w-32 h-10 flex items-center justify-center text-sm font-bold text-gray-900 bg-gray-100 border border-gray-200">
                근무자 수
              </div>
              
              {/* 각 날짜별 근무자 수 */}
              {getDaysInMonth(currentYear, currentMonth).map((day) => (
                <div 
                  key={day} 
                  className="w-13 h-10 flex items-center justify-center text-sm font-bold text-gray-900 bg-gray-100 border border-gray-200"
                >
                  {calculateWorkersCount(day)}
                </div>
              ))}
              
              {/* 연차 정보 열들 (빈 공간) */}
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-gray-100 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-gray-100 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-gray-100 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-gray-100 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-gray-100 border border-gray-200">
                -
              </div>
            </div>

            {/* 부족 인원 행 */}
            <div className="flex items-center gap-1 mb-1">
              {/* 간호사 이름 열 */}
              <div className="w-32 h-10 flex items-center justify-center text-sm font-bold text-gray-900 bg-red-50 border border-gray-200">
                부족 인원
              </div>
              
              {/* 각 날짜별 부족 인원 */}
              {getDaysInMonth(currentYear, currentMonth).map((day) => {
                const shortage = shortageData[day] || 0;
                return (
                  <div 
                    key={day} 
                    className={`w-13 h-10 flex items-center justify-center text-sm font-bold border border-gray-200 ${
                      shortage > 0 
                        ? 'text-red-600 bg-red-100' 
                        : 'text-green-600 bg-green-50'
                    }`}
                  >
                    {shortage}
                  </div>
                );
              })}
              
              {/* 연차 정보 열들 (빈 공간) */}
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-red-50 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-red-50 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-red-50 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-red-50 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-red-50 border border-gray-200">
                -
              </div>
            </div>

            {/* 일일 O근무자 수 행 */}
            <div className="flex items-center gap-1 mb-1">
              {/* 간호사 이름 열 */}
              <div className="w-32 h-10 flex items-center justify-center text-sm font-bold text-gray-900 bg-yellow-50 border border-gray-200">
                O근무자 수
              </div>
              
              {/* 각 날짜별 O근무자 수 */}
              {getDaysInMonth(currentYear, currentMonth).map((day) => (
                <div 
                  key={day} 
                  className="w-13 h-10 flex items-center justify-center text-sm font-bold text-gray-900 bg-yellow-50 border border-gray-200"
                >
                  {calculateOCount(day)}
                </div>
              ))}
              
              {/* 연차 정보 열들 (빈 공간) */}
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-yellow-50 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-yellow-50 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-yellow-50 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-yellow-50 border border-gray-200">
                -
              </div>
              <div className="w-20 h-10 flex items-center justify-center text-sm font-medium text-gray-900 bg-yellow-50 border border-gray-200">
                -
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// 현재 테이블 상태를 2차원 배열로 저장
function saveCurrentTableToArray(nurses: Nurse[], year: number, month: number, scheduleData: {[year: number]: {[month: number]: {[key: string]: string}}}): string[][] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const scheduleArray: string[][] = [];
  
  // 헤더 행 (날짜)
  const headerRow = ['간호사', ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())];
  scheduleArray.push(headerRow);
  
  // 각 간호사별 행
  nurses.forEach(nurse => {
    // 야간전담 간호사는 이름 앞에 N- 접두사 추가
    const displayName = nurse.nightDedicated ? `N-${nurse.name}` : nurse.name;
    const nurseRow = [displayName];
    
    for (let day = 1; day <= daysInMonth; day++) {
      // scheduleData에서 해당 간호사의 해당 날짜 스케줄 가져오기
      const key = `${nurse.id}-${day}`;
      const workType = scheduleData[year]?.[month]?.[key] || '-';
      nurseRow.push(workType);
    }
    
    scheduleArray.push(nurseRow);
  });
  
  return scheduleArray;
}