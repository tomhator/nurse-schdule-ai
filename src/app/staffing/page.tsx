'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  getPositions, 
  getWorkTypes, 
  saveStaffingData, 
  loadStaffingData, 
  resetStaffingData, 
  updateStaffingCount,
  saveStaffingWithTotal,
  getTotalStaffing
} from './action';

export default function StaffingPage() {
  const [staffingData, setStaffingData] = useState<{[key: string]: number}>({});

  // 직급 데이터
  const positions = [
    { id: 'HN', name: 'HN (수간호사)' },
    { id: 'RN', name: 'RN (간호사)' },
    { id: 'AN', name: 'AN (간호조무사)' }
  ];

  // 근무 유형 (O 제외)
  const workTypes = [
    { id: 'D', name: 'D (주간)', color: 'text-blue-600' },
    { id: 'E', name: 'E (저녁)', color: 'text-orange-600' },
    { id: 'N', name: 'N (야간)', color: 'text-purple-600' },
    { id: 'M', name: 'M (오전)', color: 'text-green-600' }
  ];

  // 인원 수 업데이트
  const updateStaffing = (positionId: string, workTypeId: string, value: number) => {
    const key = `${positionId}-${workTypeId}`;
    setStaffingData(prev => ({
      ...prev,
      [key]: Math.max(0, value) // 음수 방지
    }));
  };

  // 인원 수 증가
  const incrementStaffing = (positionId: string, workTypeId: string) => {
    const key = `${positionId}-${workTypeId}`;
    const currentValue = staffingData[key] || 0;
    updateStaffing(positionId, workTypeId, currentValue + 1);
  };

  // 인원 수 감소
  const decrementStaffing = (positionId: string, workTypeId: string) => {
    const key = `${positionId}-${workTypeId}`;
    const currentValue = staffingData[key] || 0;
    updateStaffing(positionId, workTypeId, currentValue - 1);
  };

  // 현재 인원 수 가져오기
  const getCurrentStaffing = (positionId: string, workTypeId: string) => {
    const key = `${positionId}-${workTypeId}`;
    return staffingData[key] || 0;
  };

  // 저장된 데이터 불러오기
  useEffect(() => {
    const savedData = localStorage.getItem('staffing_data');
    if (savedData) {
      try {
        setStaffingData(JSON.parse(savedData));
      } catch (error) {
        console.error('저장된 인원 설정 데이터를 불러오는데 실패했습니다:', error);
      }
    }
  }, []);

  // 저장
  const handleSave = () => {
    const result = saveStaffingWithTotal(staffingData);
    if (result.success) {
      alert(result.message);
    } else {
      alert(result.message);
    }
  };

  // 초기화
  const handleReset = () => {
    if (confirm('인원 설정을 초기화하시겠습니까?')) {
      setStaffingData({});
      localStorage.removeItem('staffing_data');
      alert('인원 설정이 초기화되었습니다.');
    }
  };
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 */}
      <nav className="nav bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 달력 이동 */}
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">일일 필수 근무 인원 설정</h1>
            </div>

            {/* 우측 메뉴 */}
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                일일 필수 근무 인원 설정
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 메인 바디 */}
      <main className="schedule max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">일일 필수 근무 인원 설정</h2>
            
            {/* 액션 버튼들 */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                초기화
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
              >
                저장
              </button>
            </div>
          </div>
          
          {/* 인원 설정 테이블 */}
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">
                    직급
                  </th>
                  {workTypes.map((workType) => (
                    <th key={workType.id} className="px-4 py-3 text-center text-sm font-medium text-gray-900 border-b border-gray-200">
                      <span className={workType.color}>{workType.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => (
                  <tr key={position.id} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50">
                      {position.name}
                    </td>
                    {workTypes.map((workType) => (
                      <td key={workType.id} className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => decrementStaffing(position.id, workType.id)}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-12 text-center text-lg font-semibold text-gray-900">
                            {getCurrentStaffing(position.id, workType.id)}
                          </span>
                          <button
                            onClick={() => incrementStaffing(position.id, workType.id)}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* 설명 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">설정 안내</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 각 직급별로 근무 유형에 따른 필수 인원을 설정합니다.</li>
              <li>• 화살표 버튼을 클릭하여 인원 수를 조정할 수 있습니다.</li>
              <li>• 설정한 인원은 근무표 생성 시 참고됩니다.</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
