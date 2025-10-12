// 간호사 스케줄 최적화 모듈

export interface Nurse {
  id: number;
  name: string;
  position: 'HN' | 'RN' | 'AN';
  workAvailability: {
    D: boolean;
    E: boolean;
    N: boolean;
    M: boolean;
  };
  nightDedicated: boolean;
  weekendWork: boolean;
  vacationDays: number;
  usedVacationDays: number;
}

export interface StaffingRequirement {
  [position: string]: {
    [workType: string]: number;
  };
}

export interface ScheduleConstraints {
  minDaysOff: number; // 최소 휴무일
  maxConsecutiveDays: number; // 최대 연속 근무일
  maxConsecutiveOffDays?: number; // 최대 연속 휴무일
  maxNightShifts: number; // 최대 야간 근무 횟수
  weekendWorkRequired: boolean; // 주말 근무 필수 여부
}

export interface ScheduleResult {
  success: boolean;
  schedule: { [nurseId: number]: { [day: number]: string } };
  message: string;
  violations: string[];
}

// 스케줄 최적화 메인 함수
export function optimizeSchedule(
  nurses: Nurse[],
  year: number,
  month: number,
  staffingRequirements: StaffingRequirement,
  constraints: ScheduleConstraints,
  initialSchedule?: { [nurseId: number]: { [day: number]: string } }
): ScheduleResult {
  try {
    console.log('=== 스케줄 최적화 시작 ===');
    console.log('제약 조건:', constraints);
    
    const daysInMonth = getDaysInMonth(year, month);
    const schedule: { [nurseId: number]: { [day: number]: string } } = {};
    const violations: string[] = [];
    
    // 간호사를 직급별로 정렬
    const sortedNurses = sortNursesByPosition(nurses);

    // 각 간호사별 스케줄 초기화 (기존 스케줄이 있으면 사용, 없으면 '-'로 초기화)
    sortedNurses.forEach(nurse => {
      schedule[nurse.id] = {};
      daysInMonth.forEach(day => {
        schedule[nurse.id][day] = initialSchedule?.[nurse.id]?.[day] || '-';
      });
    });

    // 1단계: 현재 근무표를 2차원 배열로 저장 (이미 page.tsx에서 저장됨)
    const scheduleArray = saveCurrentScheduleToArray(sortedNurses, schedule, daysInMonth);
    console.log('=== 스케줄 최적화 내부 근무표 2차원 배열 ===');
    console.log(scheduleArray);

    // 2단계: 기존 스케줄 검증 및 제약조건 적용
    console.log('=== 기존 스케줄 제약조건 검증 및 적용 ===');
    applyExistingScheduleConstraints(sortedNurses, schedule, daysInMonth, constraints);
    console.log('=== 기존 스케줄 제약조건 적용 완료 ===');
    
    // 제약조건 적용 후 업데이트된 스케줄 출력
    const updatedScheduleArray = saveCurrentScheduleToArray(sortedNurses, schedule, daysInMonth);
    console.log('=== 제약조건 적용 후 근무표 ===');
    console.log(updatedScheduleArray);

    // 3단계: 우선순위에 따라 스케줄 작성 (미리 입력된 부분은 건드리지 않음)
    // 우선순위: HN > 야간근무자 > RN > AN
    const priorityGroups = getNursesByPriority(sortedNurses);
    
    priorityGroups.forEach((group, groupIndex) => {
      console.log(`=== ${group.name} 그룹 스케줄 작성 시작 ===`);
      
      // 야간전담 간호사들은 교차 배정
      if (group.name === '야간전담 간호사') {
        console.log('=== 야간전담 간호사 교차 배정 시작 ===');
        if (group.nurses.length > 1) {
          applyNightDedicatedAlternatingSchedule(group.nurses, schedule, daysInMonth, year, month);
        } else {
          // 1명인 경우에도 NNOO 패턴 적용
          applySingleNightDedicatedSchedule(group.nurses[0], schedule, daysInMonth);
        }
        
        // 교차 배정 후 업데이트된 근무표 출력
        const updatedScheduleArray = saveCurrentScheduleToArray(sortedNurses, schedule, daysInMonth);
        console.log('=== 야간전담 간호사 교차 배정 완료 후 근무표 ===');
        console.log(updatedScheduleArray);
      } else if (group.name === 'AN 간호사') {
        // AN 간호사들은 일/월/목 N근무 배치
        console.log('=== AN 간호사 일/월/목 N근무 배치 시작 ===');
        applyANWeeklyNSchedule(group.nurses, schedule, daysInMonth, year, month);
        
        // N근무 배치 후 업데이트된 근무표 출력
        const updatedScheduleArray = saveCurrentScheduleToArray(sortedNurses, schedule, daysInMonth);
        console.log('=== AN 간호사 일/월/목 N근무 배치 완료 후 근무표 ===');
        console.log(updatedScheduleArray);
        
        // AN 간호사들의 나머지 스케줄 채우기 (새로 작성)
        console.log('=== AN 간호사 나머지 스케줄 채우기 시작 ===');
        group.nurses.forEach((nurse, nurseIndex) => {
          console.log(`${nurse.name} (${nurse.position}) 나머지 스케줄 채우기 시작`);
          
          // AN 전용 스케줄 생성 함수 호출
          const nurseSchedule = createANSchedule(nurse, daysInMonth, year, month, constraints, schedule);
          
          // 스케줄을 schedule 객체에 저장 (미리 입력된 부분은 덮어쓰지 않음)
          daysInMonth.forEach(day => {
            if (schedule[nurse.id][day] === '-' || schedule[nurse.id][day] === undefined) {
              schedule[nurse.id][day] = nurseSchedule[day];
            }
      });
    });

        // 빈 스케줄 채우기 후 업데이트된 근무표 출력
        const finalScheduleArray = saveCurrentScheduleToArray(sortedNurses, schedule, daysInMonth);
        console.log('=== AN 간호사 빈 스케줄 채우기 완료 후 근무표 ===');
        console.log(finalScheduleArray);
      } else {
        // 일반 간호사들은 개별 스케줄 작성 (야간전담 간호사 제외)
        group.nurses.forEach((nurse, nurseIndex) => {
          // 야간전담 간호사는 이미 위에서 처리했으므로 제외
          if (nurse.nightDedicated) {
            console.log(`${nurse.name}: 야간전담 간호사 - 개별 스케줄 생성 제외`);
            return;
          }
          
          console.log(`${nurse.name} (${nurse.position}) 스케줄 작성 시작`);
          
          // 간호사별 스케줄 작성 (미리 입력된 부분 보호)
          const nurseSchedule = createNurseSchedule(nurse, daysInMonth, year, month, constraints, schedule);
          
          // 스케줄을 schedule 객체에 저장 (미리 입력된 부분은 덮어쓰지 않음)
          daysInMonth.forEach(day => {
            if (schedule[nurse.id][day] === '-' || schedule[nurse.id][day] === undefined) {
              schedule[nurse.id][day] = nurseSchedule[day];
            }
          });
          
          // 업데이트된 근무표 배열 저장 및 콘솔 출력
          const updatedScheduleArray = saveCurrentScheduleToArray(sortedNurses, schedule, daysInMonth);
          console.log(`=== ${nurse.name} 스케줄 작성 완료 후 근무표 ===`);
          console.log(updatedScheduleArray);
        });
      }
    });

    // 4단계: RN 스케줄 조건 적용
    console.log('=== RN 스케줄 조건 적용 시작 ===');
    applyRNScheduleConditions(sortedNurses, schedule, daysInMonth, year, month);
    console.log('=== RN 스케줄 조건 적용 완료 ===');

    // 5단계: 연속근무일/연속휴무일 제약조건 강제 적용
    console.log('=== 연속근무일/연속휴무일 제약조건 강제 적용 시작 ===');
    enforceConsecutiveWorkOffLimits(sortedNurses, schedule, daysInMonth, constraints);
    console.log('=== 연속근무일/연속휴무일 제약조건 강제 적용 완료 ===');

    // 6단계: 야간전담 간호사 D/E 근무 제거
    console.log('=== 야간전담 간호사 D/E 근무 제거 시작 ===');
    removeNightDedicatedDEWork(sortedNurses, schedule, daysInMonth);
    console.log('=== 야간전담 간호사 D/E 근무 제거 완료 ===');

    // 7단계: 야간전담 간호사 NNOO 패턴 강제 적용 (최우선)
    console.log('=== 야간전담 간호사 NNOO 패턴 강제 적용 시작 (최우선) ===');
    enforceNightDedicatedNNOOPattern(sortedNurses, schedule, daysInMonth);
    console.log('=== 야간전담 간호사 NNOO 패턴 강제 적용 완료 (최우선) ===');

    // 8단계: N 근무 다음 OO 제약조건 강제 적용 (모든 간호사)
    console.log('=== N 근무 다음 OO 제약조건 강제 적용 시작 (모든 간호사) ===');
    enforceNOOConstraint(sortedNurses, schedule, daysInMonth);
    console.log('=== N 근무 다음 OO 제약조건 강제 적용 완료 (모든 간호사) ===');

    // 8단계: 최대연속근무일수/최대연속휴무일수 재검증 및 강제 적용
    console.log('=== 최대연속근무일수/최대연속휴무일수 재검증 시작 ===');
    enforceConsecutiveWorkOffLimits(sortedNurses, schedule, daysInMonth, constraints);
    console.log('=== 최대연속근무일수/최대연속휴무일수 재검증 완료 ===');

    // 9단계: E-D 근무 금지 강제 적용
    console.log('=== E-D 근무 금지 강제 적용 시작 ===');
    enforceEDProhibition(sortedNurses, schedule, daysInMonth);
    console.log('=== E-D 근무 금지 강제 적용 완료 ===');

    // 10단계: 최대 OFF 개수 제한 적용 (최소휴무일 + 2까지만 허용)
    console.log('=== 최대 OFF 개수 제한 적용 시작 ===');
    applyMaxOffDaysLimit(sortedNurses, schedule, daysInMonth, constraints);
    console.log('=== 최대 OFF 개수 제한 적용 완료 ===');

    // 11단계: N 근무 다음 OO 제약조건 최종 강제 적용
    console.log('=== N 근무 다음 OO 제약조건 최종 강제 적용 시작 ===');
    enforceNOOConstraint(sortedNurses, schedule, daysInMonth);
    console.log('=== N 근무 다음 OO 제약조건 최종 강제 적용 완료 ===');

    // 12단계: HN 간호사 스케줄 보호 및 강제 적용
    console.log('=== HN 간호사 스케줄 보호 및 강제 적용 시작 ===');
    enforceHNSchedule(sortedNurses, schedule, daysInMonth, year, month);
    console.log('=== HN 간호사 스케줄 보호 및 강제 적용 완료 ===');

    // 13단계: 야간전담 간호사 NNOO 패턴 최종 강제 적용
    console.log('=== 야간전담 간호사 NNOO 패턴 최종 강제 적용 시작 ===');
    enforceNightDedicatedNNOOPattern(sortedNurses, schedule, daysInMonth);
    console.log('=== 야간전담 간호사 NNOO 패턴 최종 강제 적용 완료 ===');

    return {
      success: violations.length === 0,
      schedule,
      message: violations.length === 0 ? '스케줄이 성공적으로 생성되었습니다.' : '일부 제약 조건을 위반했습니다.',
      violations
    };
  } catch (error) {
    return {
      success: false,
      schedule: {},
      message: '스케줄 생성 중 오류가 발생했습니다.',
      violations: [error instanceof Error ? error.message : '알 수 없는 오류']
    };
  }
}

// 간호사를 직급별로 정렬 (HN > RN > N-RN > AN)
function sortNursesByPosition(nurses: Nurse[]): Nurse[] {
  return nurses.sort((a, b) => {
    // HN > RN > N-RN > AN 순서로 정렬
    const getSortOrder = (nurse: Nurse) => {
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
  });
}

// 해당 월의 일수 구하기
function getDaysInMonth(year: number, month: number): number[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
}

// 현재 근무표를 2차원 배열로 저장
function saveCurrentScheduleToArray(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): string[][] {
  const scheduleArray: string[][] = [];
  
  // 헤더 행 (날짜)
  const headerRow = ['간호사', ...daysInMonth.map(day => day.toString())];
  scheduleArray.push(headerRow);
  
  // 각 간호사별 행
  nurses.forEach(nurse => {
    // 야간전담 간호사는 이름 앞에 N- 접두사 추가
    const displayName = nurse.nightDedicated ? `N-${nurse.name}` : nurse.name;
    const nurseRow = [displayName, ...daysInMonth.map(day => schedule[nurse.id][day] || '-')];
    scheduleArray.push(nurseRow);
  });
  
  return scheduleArray;
}

// 야간전담 간호사들의 교차 배정 처리
function applyNightDedicatedAlternatingSchedule(
  nightDedicatedNurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  year: number,
  month: number
): void {
  console.log('=== 야간전담 간호사 교차 배정 처리 ===');
  console.log('야간전담 간호사 수:', nightDedicatedNurses.length);
  
  if (nightDedicatedNurses.length === 0) return;

  // 각 야간전담 간호사별로 NNOO 패턴을 교차 배정
  nightDedicatedNurses.forEach((nurse, nurseIndex) => {
    console.log(`=== ${nurse.name} 교차 배정 시작 (nurseIndex: ${nurseIndex}) ===`);
    
    daysInMonth.forEach(day => {
      // 미리 입력된 스케줄이 있으면 건드리지 않음
      if (schedule[nurse.id][day] && schedule[nurse.id][day] !== '-') {
        console.log(`${nurse.name}: ${day}일 미리 입력된 스케줄 보호 (${schedule[nurse.id][day]})`);
        return;
      }
      
      // 교차 배정 로직: 간호사별로 다른 시작점
      // A (nurseIndex 0): NNOONNOO... (시작점 0)
      // B (nurseIndex 1): OONNOONN... (시작점 2)
      // C (nurseIndex 2): NNOONNOO... (시작점 0)
      // D (nurseIndex 3): OONNOONN... (시작점 2)
      const patternStart = (nurseIndex % 2) * 2; // 0, 2, 0, 2...
      const dayInPattern = (day - 1 + patternStart) % 4;
      
      // NNOO 패턴 배열
      const workTypes = ['N', 'N', 'O', 'O'];
      const workType = workTypes[dayInPattern];
      
      console.log(`${nurse.name}: ${day}일 패턴 계산 - nurseIndex: ${nurseIndex}, patternStart: ${patternStart}, dayInPattern: ${dayInPattern}, workType: ${workType}`);
      
      // 간호사의 근무 가능 여부 확인
      if ((workType === 'N' && nurse.workAvailability.N) || 
          (workType === 'O')) {
        schedule[nurse.id][day] = workType;
        console.log(`${nurse.name}: ${day}일 교차 배정으로 ${workType} 근무 배치`);
        
        // N 근무 배치 시 다음 2일을 자동으로 O로 설정 (N-OO 제약조건) - 강제 적용
        if (workType === 'N') {
          const nextDay1 = day + 1;
          const nextDay2 = day + 2;
          
          // 다음 2일이 월 범위 내에 있으면 무조건 O로 설정
          if (nextDay1 <= daysInMonth.length) {
            schedule[nurse.id][nextDay1] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 강제 O 설정 (기존: ${schedule[nurse.id][nextDay1]})`);
          }
          if (nextDay2 <= daysInMonth.length) {
            schedule[nurse.id][nextDay2] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 강제 O 설정 (기존: ${schedule[nurse.id][nextDay2]})`);
          }
        }
      } else {
        // N 근무가 불가능한 경우 O로 설정
        schedule[nurse.id][day] = 'O';
        console.log(`${nurse.name}: ${day}일 N 근무 불가능으로 O 배치`);
      }
    });
  });
}

// 야간전담 간호사 1명용 NNOO 패턴 적용
function applySingleNightDedicatedSchedule(
  nurse: Nurse,
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): void {
  console.log(`=== ${nurse.name} 야간전담 간호사 1명 NNOO 패턴 적용 ===`);
  
  daysInMonth.forEach(day => {
    // 미리 입력된 스케줄이 있으면 건드리지 않음
    if (schedule[nurse.id][day] && schedule[nurse.id][day] !== '-') {
      console.log(`${nurse.name}: ${day}일 미리 입력된 스케줄 보호 (${schedule[nurse.id][day]})`);
      return;
    }
    
    // NNOO 패턴 적용 (4일 주기)
    const patternIndex = (day - 1) % 4;
    let workType = '';
    
    if (patternIndex < 2) {
      workType = 'N'; // 0, 1번째는 N
    } else {
      workType = 'O'; // 2, 3번째는 O
    }
    
    schedule[nurse.id][day] = workType;
    console.log(`${nurse.name}: ${day}일 NNOO 패턴으로 ${workType} 근무 배치 (patternIndex: ${patternIndex})`);
    
    // N 근무 배치 시 다음 2일을 자동으로 O로 설정 (N-OO 제약조건) - 강제 적용
    if (workType === 'N') {
      const nextDay1 = day + 1;
      const nextDay2 = day + 2;
      
      // 다음 2일이 월 범위 내에 있으면 무조건 O로 설정
      if (nextDay1 <= daysInMonth.length) {
        schedule[nurse.id][nextDay1] = 'O';
        console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 강제 O 설정 (기존: ${schedule[nurse.id][nextDay1]})`);
      }
      if (nextDay2 <= daysInMonth.length) {
        schedule[nurse.id][nextDay2] = 'O';
        console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 강제 O 설정 (기존: ${schedule[nurse.id][nextDay2]})`);
      }
    }
  });
}

// AN 간호사들의 일/월/목 N근무 배치 처리 (완전히 새로 작성)
function applyANWeeklyNSchedule(
  anNurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  year: number,
  month: number
): void {
  console.log('=== AN 간호사 일/월/목 N근무 배치 처리 (새로 작성) ===');
  console.log('AN 간호사 수:', anNurses.length);
  
  if (anNurses.length === 0) return;
  
  // N 근무 가능한 AN 간호사들만 필터링
  const availableANNurses = anNurses.filter(nurse => nurse.workAvailability.N);
  console.log('N 근무 가능한 AN 간호사:', availableANNurses.map(n => n.name));
  
  if (availableANNurses.length === 0) {
    console.log('N 근무 가능한 AN 간호사가 없습니다.');
    return;
  }
  
  // 일/월/목 날짜들만 수집
  const targetDays = daysInMonth.filter(day => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 4; // 일(0)/월(1)/목(4)만
  });
  
  console.log('일/월/목 대상일:', targetDays);
  
  // 각 AN의 N 근무 개수 추적
  const nurseNCounts: { [nurseId: number]: number } = {};
  availableANNurses.forEach(nurse => {
    nurseNCounts[nurse.id] = 0;
  });
  
  // N 근무 개수를 균등하게 배정
  const totalNDays = targetDays.length;
  const nursesCount = availableANNurses.length;
  const baseNDays = Math.floor(totalNDays / nursesCount);
  const extraNDays = totalNDays % nursesCount;
  
  console.log(`총 N근무일: ${totalNDays}, AN 수: ${nursesCount}`);
  console.log(`기본 N근무일: ${baseNDays}, 추가 N근무일: ${extraNDays}`);
  
  // 각 AN의 목표 N 근무 개수 설정
  const targetNCounts: { [nurseId: number]: number } = {};
  availableANNurses.forEach((nurse, index) => {
    targetNCounts[nurse.id] = baseNDays + (index < extraNDays ? 1 : 0);
  });
  
  console.log('목표 N근무 개수:', targetNCounts);
  
  // 각 대상일에 딱 1명만 N근무 배정
  targetDays.forEach(day => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdayNames[dayOfWeek];
    
    console.log(`${day}일 (${weekday}): N근무 배정 시작`);
    
    // 이미 N근무가 배정된 AN이 있는지 확인
    let assignedNurse = null;
    for (const nurse of availableANNurses) {
      if (schedule[nurse.id][day] === 'N') {
        assignedNurse = nurse;
        console.log(`${nurse.name}: ${day}일 이미 N근무 배정됨`);
        break;
      }
    }
    
    // N근무가 배정되지 않은 경우에만 1명 배정
    if (!assignedNurse) {
      // 미리 입력된 스케줄이 없고, 목표 N근무 개수에 도달하지 않은 AN 중에서 선택
      const availableNurses = availableANNurses.filter(nurse => {
        const existingSchedule = schedule[nurse.id][day];
        const hasNoSchedule = !existingSchedule || existingSchedule === '-';
        const needsMoreN = nurseNCounts[nurse.id] < targetNCounts[nurse.id];
        return hasNoSchedule && needsMoreN;
      });
      
      if (availableNurses.length > 0) {
        // N근무 개수가 가장 적은 AN을 우선 선택
        availableNurses.sort((a, b) => nurseNCounts[a.id] - nurseNCounts[b.id]);
        const selectedNurse = availableNurses[0];
        
        // N 근무 배치 (딱 1명만)
        schedule[selectedNurse.id][day] = 'N';
        nurseNCounts[selectedNurse.id]++;
        console.log(`${selectedNurse.name}: ${day}일 N근무 배정 완료 (현재 N개수: ${nurseNCounts[selectedNurse.id]})`);
        
        // N 다음 2일을 자동으로 O로 설정
        const nextDay1 = day + 1;
        const nextDay2 = day + 2;
        
        if (nextDay1 <= daysInMonth.length && schedule[selectedNurse.id][nextDay1] === '-') {
          schedule[selectedNurse.id][nextDay1] = 'O';
          console.log(`${selectedNurse.name}: N 근무 후 ${nextDay1}일 자동 O 설정`);
        }
        if (nextDay2 <= daysInMonth.length && schedule[selectedNurse.id][nextDay2] === '-') {
          schedule[selectedNurse.id][nextDay2] = 'O';
          console.log(`${selectedNurse.name}: N 근무 후 ${nextDay2}일 자동 O 설정`);
        }
      } else {
        console.log(`${day}일: 배정 가능한 AN 간호사가 없습니다.`);
      }
    }
  });
  
  console.log('최종 N근무 개수:', nurseNCounts);
}

// AN 간호사 전용 스케줄 생성 함수
function createANSchedule(
  nurse: Nurse,
  daysInMonth: number[],
  year: number,
  month: number,
  constraints: ScheduleConstraints,
  existingSchedule: { [nurseId: number]: { [day: number]: string } }
): { [day: number]: string } {
  const nurseSchedule: { [day: number]: string } = {};
  
  console.log(`=== ${nurse.name} AN 스케줄 생성 시작 ===`);
  
  // 1단계: 미리 입력된 스케줄 보호 및 빈 상태로 초기화
  daysInMonth.forEach(day => {
    const existingWorkType = existingSchedule?.[nurse.id]?.[day];
    
    if (existingWorkType && existingWorkType !== '-') {
      // 미리 입력된 스케줄 보호
      nurseSchedule[day] = existingWorkType;
      console.log(`${nurse.name}: ${day}일 미리 입력된 스케줄 보호 (${existingWorkType})`);
    } else {
      // 빈 상태로 초기화
      nurseSchedule[day] = '-';
    }
  });
  
  // 2단계: AN 스케줄 생성 (D, E, M 위주, N은 일/월/목에만)
  const minOffDays = constraints.minDaysOff;
  const totalDays = daysInMonth.length;
  const maxWorkDays = totalDays - minOffDays;
  
  let workDays = 0;
  let offDays = 0;
  let consecutiveWorkDays = 0;
  let consecutiveOffDays = 0;
  
  for (let day of daysInMonth) {
    // 미리 입력된 스케줄이 있으면 건드리지 않음
    if (nurseSchedule[day] !== '-') {
      // 미리 입력된 스케줄은 그대로 유지하고 카운트만 업데이트
      const workType = nurseSchedule[day];
      if (workType === 'O') {
        offDays++;
        consecutiveOffDays++;
        consecutiveWorkDays = 0;
      } else {
        workDays++;
        consecutiveWorkDays++;
        consecutiveOffDays = 0;
      }
      continue;
    }
    
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHolidayDay = isHoliday(year, month, day);
    
    // 제약 조건 체크 - 더 엄격하게 적용
    const canWork = workDays < maxWorkDays &&
                   consecutiveWorkDays < constraints.maxConsecutiveDays;
    const mustOff = consecutiveOffDays >= (constraints.maxConsecutiveOffDays || 3) ||
                   (workDays >= maxWorkDays) ||
                   consecutiveWorkDays >= constraints.maxConsecutiveDays;
    
    if (mustOff || !canWork) {
      // 휴무 배치
      nurseSchedule[day] = 'O';
      offDays++;
      consecutiveOffDays++;
      consecutiveWorkDays = 0;
    } else {
      // 근무 배치 (AN은 D, E, M 위주)
      const availableWorkTypes = getAvailableWorkTypes(nurse, day, isWeekend, isHolidayDay);
      
      // AN은 N근무를 일/월/목에만 배정 (이미 배정된 경우는 제외)
      const filteredWorkTypes = availableWorkTypes.filter(workType => {
        if (workType === 'N') {
          // N근무는 일/월/목에만 배정
          return dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 4;
        }
        return true;
      });
      
      // 제약사항 적용: N 다음에는 O 2개, E 다음에는 D 금지
      const finalWorkTypes = applyWorkTypeConstraints(filteredWorkTypes, nurseSchedule, day, daysInMonth);
      
      if (finalWorkTypes.length > 0) {
        // 선호 근무를 고려한 근무 유형 선택
        const selectedWorkType = selectWorkTypeByPreference(finalWorkTypes, nurse);
        nurseSchedule[day] = selectedWorkType;
        console.log(`${nurse.name}: ${day}일 ${selectedWorkType} 근무 배정`);
        
        // N 근무 배치 시 다음 2일을 자동으로 O로 설정
        if (selectedWorkType === 'N') {
          const nextDay1 = day + 1;
          const nextDay2 = day + 2;
          
          if (nextDay1 <= daysInMonth.length && nurseSchedule[nextDay1] === '-') {
            nurseSchedule[nextDay1] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 자동 O 설정`);
            offDays++;
            consecutiveOffDays++;
          }
          if (nextDay2 <= daysInMonth.length && nurseSchedule[nextDay2] === '-') {
            nurseSchedule[nextDay2] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 자동 O 설정`);
            offDays++;
            consecutiveOffDays++;
          }
        }
        
        workDays++;
        consecutiveWorkDays++;
        // N 근무가 아닌 경우에만 consecutiveOffDays 리셋
        if (selectedWorkType !== 'N') {
          consecutiveOffDays = 0;
        }
      } else {
        // 가능한 근무 유형이 없으면 휴무
        nurseSchedule[day] = 'O';
        offDays++;
        consecutiveOffDays++;
        consecutiveWorkDays = 0;
      }
    }
  }
  
  // 3단계: 최소 휴무일 보장 확인 및 조정
  if (offDays < minOffDays) {
    console.log(`${nurse.name}: 최소 휴무일 부족 (${offDays}/${minOffDays}), 추가 조정 필요`);
  }
  
  // 4단계: 최대 연속 휴무일 초과 시 강제 근무 배치
  const maxConsecutiveOffDays = constraints.maxConsecutiveOffDays || 3;
  let finalConsecutiveOffDays = 0;
  
  for (let i = 0; i < daysInMonth.length; i++) {
    const day = daysInMonth[i];
    const workType = nurseSchedule[day];
    
    if (workType === 'O') {
      finalConsecutiveOffDays++;
      
      // 최대 연속 휴무일 초과 시 강제 근무 배치
      if (finalConsecutiveOffDays > maxConsecutiveOffDays) {
        const workTypes = ['D', 'E', 'M']; // AN은 M 근무도 가능
        // M 근무는 AN만 가능
        if (nurse.position === 'AN') {
          workTypes.push('M');
        }
        const selectedWorkType = selectWorkTypeByPreference(workTypes, nurse);
        nurseSchedule[day] = selectedWorkType;
        console.log(`${nurse.name}: 최대 연속 휴무일 초과로 ${day}일 강제 ${selectedWorkType} 배치`);
        finalConsecutiveOffDays = 0;
      }
    } else {
      finalConsecutiveOffDays = 0;
    }
  }
  
  console.log(`=== ${nurse.name} AN 스케줄 생성 완료 ===`);
  return nurseSchedule;
}

// 최대 OFF 개수 제한 적용 (최소휴무일 + 2까지만 허용)
function applyMaxOffDaysLimit(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints
): void {
  console.log('=== 최대 OFF 개수 제한 적용 ===');
  
  nurses.forEach(nurse => {
    console.log(`=== ${nurse.name} 최대 OFF 개수 제한 적용 ===`);
    
    // 야간전담 간호사는 제외 (N과 O만 가능, 휴무일 제한 무시)
    if (nurse.nightDedicated) {
      console.log(`${nurse.name}: 야간전담 간호사 - 최대 OFF 개수 제한 적용 제외 (휴무일 제한 무시)`);
      return;
    }
    
    // 현재 OFF 개수 계산
    let currentOffCount = 0;
    daysInMonth.forEach(day => {
      if (schedule[nurse.id][day] === 'O') {
        currentOffCount++;
      }
    });
    
    // 최대 허용 OFF 개수 (최소휴무일 + 2)
    const maxAllowedOffDays = constraints.minDaysOff + 2;
    
    console.log(`${nurse.name}: 현재 OFF 개수 ${currentOffCount}, 최대 허용 ${maxAllowedOffDays}`);
    
    // OFF 개수가 최대 허용 개수를 초과하는 경우
    if (currentOffCount > maxAllowedOffDays) {
      const excessOffDays = currentOffCount - maxAllowedOffDays;
      console.log(`${nurse.name}: OFF 개수 초과 (${excessOffDays}개 초과), 근무로 변경 시작`);
      
      // 초과된 OFF 개수만큼 근무로 변경
      let changedCount = 0;
      for (let day of daysInMonth) {
        if (changedCount >= excessOffDays) break;
        
        if (schedule[nurse.id][day] === 'O') {
          // 미리 입력된 스케줄이 아닌 경우에만 변경
          const existingSchedule = schedule[nurse.id][day];
          if (!existingSchedule || existingSchedule === 'O') {
            // 가능한 근무 유형 중에서 선택
            const availableWorkTypes = getAvailableWorkTypes(nurse, day, false, false);
            
            // 제약사항 적용: N 다음에는 O 2개, E 다음에는 D 금지
            const filteredWorkTypes = applyWorkTypeConstraints(availableWorkTypes, schedule[nurse.id], day, daysInMonth);
            
            if (filteredWorkTypes.length > 0) {
              // 선호 근무를 고려한 근무 유형 선택
              const selectedWorkType = selectWorkTypeByPreference(filteredWorkTypes, nurse);
              schedule[nurse.id][day] = selectedWorkType;
              changedCount++;
              console.log(`${nurse.name}: ${day}일 O를 ${selectedWorkType}로 변경 (${changedCount}/${excessOffDays})`);
              
              // N 근무 배치 시 다음 2일을 자동으로 O로 설정
              if (selectedWorkType === 'N') {
                const nextDay1 = day + 1;
                const nextDay2 = day + 2;
                
                if (nextDay1 <= daysInMonth.length && schedule[nurse.id][nextDay1] === '-') {
                  schedule[nurse.id][nextDay1] = 'O';
                  console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 자동 O 설정`);
                }
                if (nextDay2 <= daysInMonth.length && schedule[nurse.id][nextDay2] === '-') {
                  schedule[nurse.id][nextDay2] = 'O';
                  console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 자동 O 설정`);
                }
              }
            } else {
              // 가능한 근무 유형이 없으면 D로 강제 변경
              schedule[nurse.id][day] = 'D';
              changedCount++;
              console.log(`${nurse.name}: ${day}일 O를 D로 강제 변경 (${changedCount}/${excessOffDays})`);
            }
          }
        }
      }
      
      console.log(`${nurse.name}: OFF 개수 제한 적용 완료 (${changedCount}개 변경)`);
    } else {
      console.log(`${nurse.name}: OFF 개수 정상 (${currentOffCount}/${maxAllowedOffDays})`);
    }
  });
}

// RN 스케줄 조건 적용
function applyRNScheduleConditions(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  year: number,
  month: number
): void {
  console.log('=== RN 스케줄 조건 적용 ===');
  
  // RN 간호사들만 필터링 (야간전담 제외)
  const rnNurses = nurses.filter(nurse => nurse.position === 'RN' && !nurse.nightDedicated);
  console.log('RN 간호사 수:', rnNurses.length);
  
  if (rnNurses.length === 0) {
    console.log('RN 간호사가 없습니다.');
    return;
  }
  
  // 각 날짜별로 RN 스케줄 조건 확인 및 적용
  daysInMonth.forEach(day => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdayNames[dayOfWeek];
    
    console.log(`${day}일 (${weekday}): RN 스케줄 조건 확인`);
    
    // 1. RN이 모두 O인지 확인
    const rnWorkTypes = rnNurses.map(nurse => schedule[nurse.id][day]);
    const allOff = rnWorkTypes.every(workType => workType === 'O' || workType === '-');
    
    if (allOff) {
      console.log(`${day}일: RN이 모두 O - 최소 1명 근무 배치 필요`);
      
      // 최소 1명의 RN을 근무로 배치
      const availableRNs = rnNurses.filter(nurse => {
        const existingSchedule = schedule[nurse.id][day];
        return !existingSchedule || existingSchedule === '-' || existingSchedule === 'O';
      });
      
      if (availableRNs.length > 0) {
        // 첫 번째 RN을 D 근무로 배치
        const selectedRN = availableRNs[0];
        schedule[selectedRN.id][day] = 'D';
        console.log(`${selectedRN.name}: ${day}일 D 근무 배치 (RN 모두 O 방지)`);
      }
    }
    
    // 2. RN 근무자들 중 E 근무는 1명만 허용
    const rnWorkers = rnNurses.filter(nurse => {
      const workType = schedule[nurse.id][day];
      return workType && workType !== 'O' && workType !== '-';
    });
    
    const eWorkers = rnWorkers.filter(nurse => schedule[nurse.id][day] === 'E');
    
    if (eWorkers.length > 1) {
      console.log(`${day}일: RN E 근무자 ${eWorkers.length}명 - 1명만 허용, ${eWorkers.length - 1}명 변경 필요`);
      
      // E 근무자를 1명만 남기고 나머지는 다른 근무로 변경
      const excessEWorkers = eWorkers.slice(1); // 첫 번째 제외하고 나머지
      
      excessEWorkers.forEach(nurse => {
        // 미리 입력된 스케줄이 아닌 경우에만 변경
        const existingSchedule = schedule[nurse.id][day];
        if (!existingSchedule || existingSchedule === 'E') {
          // 가능한 근무 유형 중에서 선택 (E 제외)
          const availableWorkTypes = getAvailableWorkTypes(nurse, day, false, false);
          const filteredWorkTypes = availableWorkTypes.filter(workType => workType !== 'E');
          
          if (filteredWorkTypes.length > 0) {
            // 제약사항 적용: N 다음에는 O 2개, E 다음에는 D 금지
            const finalWorkTypes = applyWorkTypeConstraints(filteredWorkTypes, schedule[nurse.id], day, daysInMonth);
            
            if (finalWorkTypes.length > 0) {
              // 선호 근무를 고려한 근무 유형 선택
              const selectedWorkType = selectWorkTypeByPreference(finalWorkTypes, nurse);
              schedule[nurse.id][day] = selectedWorkType;
              console.log(`${nurse.name}: ${day}일 E를 ${selectedWorkType}로 변경 (RN E 근무 1명 제한)`);
              
              // N 근무 배치 시 다음 2일을 자동으로 O로 설정
              if (selectedWorkType === 'N') {
                const nextDay1 = day + 1;
                const nextDay2 = day + 2;
                
                if (nextDay1 <= daysInMonth.length && schedule[nurse.id][nextDay1] === '-') {
                  schedule[nurse.id][nextDay1] = 'O';
                  console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 자동 O 설정`);
                }
                if (nextDay2 <= daysInMonth.length && schedule[nurse.id][nextDay2] === '-') {
                  schedule[nurse.id][nextDay2] = 'O';
                  console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 자동 O 설정`);
                }
              }
            } else {
              // 가능한 근무 유형이 없으면 D로 강제 변경
              schedule[nurse.id][day] = 'D';
              console.log(`${nurse.name}: ${day}일 E를 D로 강제 변경 (RN E 근무 1명 제한)`);
            }
          } else {
            // E 외에 가능한 근무 유형이 없으면 D로 강제 변경
            schedule[nurse.id][day] = 'D';
            console.log(`${nurse.name}: ${day}일 E를 D로 강제 변경 (RN E 근무 1명 제한)`);
        }
      }
    });
    }
    
    // 최종 RN 근무자 수 확인
    const finalRnWorkers = rnNurses.filter(nurse => {
      const workType = schedule[nurse.id][day];
      return workType && workType !== 'O' && workType !== '-';
    });
    
    const finalEWorkers = finalRnWorkers.filter(nurse => schedule[nurse.id][day] === 'E');
    
    console.log(`${day}일: RN 근무자 ${finalRnWorkers.length}명 (E 근무자 ${finalEWorkers.length}명)`);
  });
}

// 연속근무일/연속휴무일 제약조건 강제 적용
function enforceConsecutiveWorkOffLimits(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints
): void {
  console.log('=== 연속근무일/연속휴무일 제약조건 강제 적용 ===');
  
  nurses.forEach(nurse => {
    console.log(`=== ${nurse.name} 연속근무일/연속휴무일 제약조건 적용 ===`);
    
    // 야간전담 간호사는 제외 (N과 O만 가능, 휴무일 제한 무시)
    if (nurse.nightDedicated) {
      console.log(`${nurse.name}: 야간전담 간호사 - 연속근무일/연속휴무일 제약조건 적용 제외 (휴무일 제한 무시)`);
      return;
    }
    
    const maxConsecutiveDays = constraints.maxConsecutiveDays;
    const maxConsecutiveOffDays = constraints.maxConsecutiveOffDays || 3;
    
    let consecutiveWorkDays = 0;
    let consecutiveOffDays = 0;
    let startWorkDay = -1;
    let startOffDay = -1;
    
    // 1단계: 연속근무일 제한 적용
    for (let i = 0; i < daysInMonth.length; i++) {
      const day = daysInMonth[i];
      const workType = schedule[nurse.id][day];
      
      if (workType && workType !== 'O' && workType !== '-') {
        if (consecutiveWorkDays === 0) {
          startWorkDay = day;
        }
        consecutiveWorkDays++;
        consecutiveOffDays = 0;
        
        // 최대 연속근무일 초과 시 강제 휴무 배치 (무조건 적용)
        if (consecutiveWorkDays > maxConsecutiveDays) {
        schedule[nurse.id][day] = 'O';
          console.log(`${nurse.name}: 최대 연속근무일 초과로 ${day}일 강제 O 배치 (${consecutiveWorkDays}일 > ${maxConsecutiveDays}일) - 무조건 적용`);
          consecutiveWorkDays = 0;
          consecutiveOffDays = 1;
        }
      } else {
        consecutiveWorkDays = 0;
      }
    }
    
    // 2단계: 연속휴무일 제한 적용
    consecutiveWorkDays = 0;
    consecutiveOffDays = 0;
    
    for (let i = 0; i < daysInMonth.length; i++) {
      const day = daysInMonth[i];
      const workType = schedule[nurse.id][day];
      
      if (workType === 'O') {
        if (consecutiveOffDays === 0) {
          startOffDay = day;
        }
        consecutiveOffDays++;
        consecutiveWorkDays = 0;
        
        // 최대 연속휴무일 초과 시 강제 근무 배치 (무조건 적용)
        if (consecutiveOffDays > maxConsecutiveOffDays) {
          // 가능한 근무 유형 중에서 선택
          const availableWorkTypes = getAvailableWorkTypes(nurse, day, false, false);
          
          // 제약사항 적용: N 다음에는 O 2개, E 다음에는 D 금지
          const filteredWorkTypes = applyWorkTypeConstraints(availableWorkTypes, schedule[nurse.id], day, daysInMonth);
          
          if (filteredWorkTypes.length > 0) {
            // 선호 근무를 고려한 근무 유형 선택
            const selectedWorkType = selectWorkTypeByPreference(filteredWorkTypes, nurse);
            schedule[nurse.id][day] = selectedWorkType;
            console.log(`${nurse.name}: 최대 연속휴무일 초과로 ${day}일 강제 ${selectedWorkType} 배치 (${consecutiveOffDays}일 > ${maxConsecutiveOffDays}일) - 무조건 적용`);
            
            // N 근무 배치 시 다음 2일을 자동으로 O로 설정
            if (selectedWorkType === 'N') {
              const nextDay1 = day + 1;
              const nextDay2 = day + 2;
              
              if (nextDay1 <= daysInMonth.length && schedule[nurse.id][nextDay1] === '-') {
                schedule[nurse.id][nextDay1] = 'O';
                console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 자동 O 설정`);
              }
              if (nextDay2 <= daysInMonth.length && schedule[nurse.id][nextDay2] === '-') {
                schedule[nurse.id][nextDay2] = 'O';
                console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 자동 O 설정`);
              }
            }
            
            consecutiveOffDays = 0;
            consecutiveWorkDays = 1;
          } else {
            // 가능한 근무 유형이 없으면 D로 강제 변경 (무조건 적용)
            schedule[nurse.id][day] = 'D';
            console.log(`${nurse.name}: 최대 연속휴무일 초과로 ${day}일 강제 D 배치 (${consecutiveOffDays}일 > ${maxConsecutiveOffDays}일) - 무조건 적용`);
            consecutiveOffDays = 0;
            consecutiveWorkDays = 1;
          }
        }
      } else {
        consecutiveOffDays = 0;
      }
    }
    
    console.log(`${nurse.name}: 연속근무일/연속휴무일 제약조건 적용 완료`);
  });
}

// 야간전담 간호사 D/E 근무 제거
function removeNightDedicatedDEWork(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): void {
  console.log('=== 야간전담 간호사 D/E 근무 제거 ===');
  
  // 야간전담 간호사들만 필터링
  const nightDedicatedNurses = nurses.filter(nurse => nurse.nightDedicated);
  console.log('야간전담 간호사 수:', nightDedicatedNurses.length);
  
  nightDedicatedNurses.forEach(nurse => {
    console.log(`=== ${nurse.name} D/E 근무 제거 ===`);
    
    let changedCount = 0;
    
    daysInMonth.forEach(day => {
      const workType = schedule[nurse.id][day];
      
      // D 또는 E 근무가 배치된 경우 O로 변경
      if (workType === 'D' || workType === 'E') {
        schedule[nurse.id][day] = 'O';
        changedCount++;
        console.log(`${nurse.name}: ${day}일 ${workType} 근무를 O로 변경 (야간전담은 N과 O만 가능)`);
      }
    });
    
    console.log(`${nurse.name}: D/E 근무 제거 완료 (${changedCount}개 변경)`);
  });
}

// N 근무 다음 OO 제약조건 강제 적용 (모든 간호사)
function enforceNOOConstraint(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): void {
  console.log('=== N 근무 다음 OO 제약조건 강제 적용 (모든 간호사) ===');
  
  nurses.forEach(nurse => {
    console.log(`=== ${nurse.name} N 근무 다음 OO 제약조건 적용 ===`);
    
    let changedCount = 0;
    
    // 각 날짜를 순회하면서 N 근무 다음 2일을 O로 강제 설정
    for (let i = 0; i < daysInMonth.length - 2; i++) {
      const day = daysInMonth[i];
      const workType = schedule[nurse.id][day];
      
      if (workType === 'N') {
        const nextDay1 = day + 1;
        const nextDay2 = day + 2;
        
        // 다음 2일이 월 범위 내에 있는지 확인
        if (nextDay1 <= daysInMonth.length && nextDay2 <= daysInMonth.length) {
          // 다음 2일이 O가 아닌 경우 강제로 O로 변경 (모든 간호사)
          if (schedule[nurse.id][nextDay1] !== 'O') {
            schedule[nurse.id][nextDay1] = 'O';
            changedCount++;
            console.log(`${nurse.name}: N 근무 후 ${nextDay1}일을 강제 O로 변경 (N-OO 제약조건, 기존: ${schedule[nurse.id][nextDay1]})`);
          }
          
          if (schedule[nurse.id][nextDay2] !== 'O') {
            schedule[nurse.id][nextDay2] = 'O';
            changedCount++;
            console.log(`${nurse.name}: N 근무 후 ${nextDay2}일을 강제 O로 변경 (N-OO 제약조건, 기존: ${schedule[nurse.id][nextDay2]})`);
          }
        }
      }
    }
    
    console.log(`${nurse.name}: N 근무 다음 OO 제약조건 적용 완료 (${changedCount}개 변경)`);
  });
}

// 야간전담 간호사 NNOO 패턴 강제 적용 (휴무일 제한 무시)
function enforceNightDedicatedNNOOPattern(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): void {
  console.log('=== 야간전담 간호사 NNOO 패턴 강제 적용 (휴무일 제한 무시) ===');
  
  // 야간전담 간호사들만 필터링
  const nightDedicatedNurses = nurses.filter(nurse => nurse.nightDedicated);
  console.log('야간전담 간호사 수:', nightDedicatedNurses.length);
  
  if (nightDedicatedNurses.length === 0) {
    console.log('야간전담 간호사가 없습니다.');
    return;
  }
  
  nightDedicatedNurses.forEach((nurse, nurseIndex) => {
    console.log(`=== ${nurse.name} NNOO 패턴 강제 적용 (휴무일 제한 무시) ===`);
    
    let changedCount = 0;
    
    // 각 날짜를 순회하면서 NNOO 패턴 강제 적용 (휴무일 제한 무시)
    for (let i = 0; i < daysInMonth.length; i++) {
      const day = daysInMonth[i];
      const currentWorkType = schedule[nurse.id][day];
      
      // 교차 배정을 위한 패턴 계산
      // A (nurseIndex 0): NNOONNOO... (시작점 0)
      // B (nurseIndex 1): OONNOONN... (시작점 2)
      // C (nurseIndex 2): NNOONNOO... (시작점 0)
      // D (nurseIndex 3): OONNOONN... (시작점 2)
      const patternStart = (nurseIndex % 2) * 2; // 0, 2, 0, 2...
      const dayInPattern = (day - 1 + patternStart) % 4;
      
      // NNOO 패턴 배열
      const workTypes = ['N', 'N', 'O', 'O'];
      const expectedWorkType = workTypes[dayInPattern];
      
      console.log(`${nurse.name}: ${day}일 패턴 계산 - nurseIndex: ${nurseIndex}, patternStart: ${patternStart}, dayInPattern: ${dayInPattern}, expectedWorkType: ${expectedWorkType}, currentWorkType: ${currentWorkType}`);
      
      // 현재 근무가 예상과 다르면 강제 변경 (휴무일 제한 무시)
      if (currentWorkType !== expectedWorkType) {
        schedule[nurse.id][day] = expectedWorkType;
        changedCount++;
        console.log(`${nurse.name}: ${day}일 ${currentWorkType}를 ${expectedWorkType}로 강제 변경 (NNOO 패턴, 휴무일 제한 무시)`);
      }
      
      // N 근무 다음 2일을 강제 O로 설정 (휴무일 제한 무시)
      if (expectedWorkType === 'N') {
        const nextDay1 = day + 1;
        const nextDay2 = day + 2;
        
        if (nextDay1 <= daysInMonth.length && schedule[nurse.id][nextDay1] !== 'O') {
          schedule[nurse.id][nextDay1] = 'O';
          changedCount++;
          console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 강제 O 설정 (휴무일 제한 무시)`);
        }
        if (nextDay2 <= daysInMonth.length && schedule[nurse.id][nextDay2] !== 'O') {
          schedule[nurse.id][nextDay2] = 'O';
          changedCount++;
          console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 강제 O 설정 (휴무일 제한 무시)`);
        }
      }
    }
    
    console.log(`${nurse.name}: NNOO 패턴 강제 적용 완료 (${changedCount}개 변경, 휴무일 제한 무시)`);
  });
}

// HN 간호사 스케줄 보호 및 강제 적용
function enforceHNSchedule(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  year: number,
  month: number
): void {
  console.log('=== HN 간호사 스케줄 보호 및 강제 적용 ===');
  
  // HN 간호사들만 필터링
  const hnNurses = nurses.filter(nurse => nurse.position === 'HN');
  console.log('HN 간호사 수:', hnNurses.length);
  
  if (hnNurses.length === 0) {
    console.log('HN 간호사가 없습니다.');
    return;
  }
  
  hnNurses.forEach(nurse => {
    console.log(`=== ${nurse.name} HN 스케줄 강제 적용 ===`);
    
    let changedCount = 0;
    
    daysInMonth.forEach(day => {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const isHolidayDay = isHoliday(year, month, day);
      const currentWorkType = schedule[nurse.id][day];
      
      // HN 간호사 규칙: 평일 D, 주말/공휴일 O
      let expectedWorkType = '';
      
      if (isHolidayDay || dayOfWeek === 0 || dayOfWeek === 6) {
        expectedWorkType = 'O'; // 주말/공휴일은 O
      } else {
        expectedWorkType = 'D'; // 평일은 D
      }
      
      // 현재 근무가 예상과 다르면 강제 변경
      if (currentWorkType !== expectedWorkType) {
        schedule[nurse.id][day] = expectedWorkType;
        changedCount++;
        console.log(`${nurse.name}: ${day}일 ${currentWorkType}를 ${expectedWorkType}로 강제 변경 (HN 규칙: ${isHolidayDay || dayOfWeek === 0 || dayOfWeek === 6 ? '주말/공휴일' : '평일'})`);
      }
    });
    
    console.log(`${nurse.name}: HN 스케줄 강제 적용 완료 (${changedCount}개 변경)`);
  });
}

// E-D 근무 금지 강제 적용
function enforceEDProhibition(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): void {
  console.log('=== E-D 근무 금지 강제 적용 ===');
  
  nurses.forEach(nurse => {
    console.log(`=== ${nurse.name} E-D 근무 금지 적용 ===`);
    
    let changedCount = 0;
    
    // 각 날짜를 순회하면서 E 다음 D 근무를 찾아서 변경
    for (let i = 0; i < daysInMonth.length - 1; i++) {
      const currentDay = daysInMonth[i];
      const nextDay = daysInMonth[i + 1];
      
      const currentWorkType = schedule[nurse.id][currentDay];
      const nextWorkType = schedule[nurse.id][nextDay];
      
      // E 다음에 D가 오는 경우를 찾아서 변경
      if (currentWorkType === 'E' && nextWorkType === 'D') {
        // D를 다른 근무로 변경 (O, E, N 중 선택)
        const alternativeWorkTypes = ['O', 'E', 'N'];
        
        // AN인 경우 M도 추가
        if (nurse.position === 'AN') {
          alternativeWorkTypes.push('M');
        }
        
        // 선호 근무를 고려한 대안 선택
        const selectedAlternative = selectWorkTypeByPreference(alternativeWorkTypes, nurse);
        schedule[nurse.id][nextDay] = selectedAlternative;
        changedCount++;
        console.log(`${nurse.name}: ${nextDay}일 E-D 금지로 D를 ${selectedAlternative}로 변경`);
      }
    }
    
    console.log(`${nurse.name}: E-D 근무 금지 적용 완료 (${changedCount}개 변경)`);
  });
}

// 우선순위에 따라 간호사 그룹화
function getNursesByPriority(nurses: Nurse[]): { name: string, nurses: Nurse[] }[] {
  const groups = [
    { name: 'HN 간호사', nurses: nurses.filter(nurse => nurse.position === 'HN') },
    { name: '야간전담 간호사', nurses: nurses.filter(nurse => nurse.nightDedicated) },
    { name: 'RN 간호사', nurses: nurses.filter(nurse => nurse.position === 'RN' && !nurse.nightDedicated) },
    { name: 'AN 간호사', nurses: nurses.filter(nurse => nurse.position === 'AN' && !nurse.nightDedicated) }
  ];
  
  return groups.filter(group => group.nurses.length > 0);
}

// 기존 스케줄에 제약조건 적용
function applyExistingScheduleConstraints(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints?: ScheduleConstraints
): void {
  nurses.forEach(nurse => {
    console.log(`=== ${nurse.name} 기존 스케줄 제약조건 적용 ===`);
    
    // 야간전담 간호사는 제외 (N과 O만 가능, 휴무일 제한 무시)
    if (nurse.nightDedicated) {
      console.log(`${nurse.name}: 야간전담 간호사 - 기존 스케줄 제약조건 적용 제외 (휴무일 제한 무시)`);
      return;
    }
    
    // 1. N 다음에는 O 2개 제약조건 적용 (더 엄격하게)
    for (let i = 0; i < daysInMonth.length - 2; i++) {
      const day = daysInMonth[i];
      const workType = schedule[nurse.id][day];
      
      if (workType === 'N') {
        const nextDay1 = day + 1;
        const nextDay2 = day + 2;
        
        // 다음 2일이 월 범위 내에 있는지 확인
        if (nextDay1 <= daysInMonth.length && nextDay2 <= daysInMonth.length) {
          // 다음 2일이 O가 아닌 경우 강제로 O로 변경 (빈 상태든 다른 근무든 상관없이)
          if (schedule[nurse.id][nextDay1] !== 'O') {
            schedule[nurse.id][nextDay1] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 강제 O 설정 (기존: ${schedule[nurse.id][nextDay1]})`);
          }
          if (schedule[nurse.id][nextDay2] !== 'O') {
            schedule[nurse.id][nextDay2] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 강제 O 설정 (기존: ${schedule[nurse.id][nextDay2]})`);
          }
        }
      }
    }
    
    // 2. E 다음에는 D 금지 제약조건 검증 및 수정
    for (let i = 1; i < daysInMonth.length; i++) {
      const prevDay = daysInMonth[i - 1];
      const currentDay = daysInMonth[i];
      const prevWorkType = schedule[nurse.id][prevDay];
      const currentWorkType = schedule[nurse.id][currentDay];
      
      if (prevWorkType === 'E' && currentWorkType === 'D') {
        // E 다음 D인 경우 D를 다른 근무 유형으로 변경
        const alternativeWorkTypes = ['E', 'N', 'M', 'O'];
        const selectedAlternative = alternativeWorkTypes[Math.floor(Math.random() * alternativeWorkTypes.length)];
        schedule[nurse.id][currentDay] = selectedAlternative;
        console.log(`${nurse.name}: E-D 제약 위반으로 ${currentDay}일 D를 ${selectedAlternative}로 변경`);
      }
    }
    
    // 3. 최대 연속 휴무일 초과 시 강제 근무 배치
    if (constraints) {
      const maxConsecutiveOffDays = constraints.maxConsecutiveOffDays || 3;
      let consecutiveOffDays = 0;
      let startOffDay = -1;
      
      for (let i = 0; i < daysInMonth.length; i++) {
        const day = daysInMonth[i];
        const workType = schedule[nurse.id][day];
        
        if (workType === 'O') {
          if (consecutiveOffDays === 0) {
            startOffDay = day;
          }
          consecutiveOffDays++;
          
          // 최대 연속 휴무일 초과 시 강제 근무 배치
          if (consecutiveOffDays > maxConsecutiveOffDays) {
            const workTypes = ['D', 'E', 'N'];
            // M 근무는 AN만 가능
            if (nurse.position === 'AN') {
              workTypes.push('M');
            }
            // 선호 근무를 고려한 강제 근무 배치
            const selectedWorkType = selectWorkTypeByPreference(workTypes, nurse);
            schedule[nurse.id][day] = selectedWorkType;
            console.log(`${nurse.name}: 최대 연속 휴무일 초과로 ${day}일 강제 ${selectedWorkType} 배치 (선호 근무 고려)`);
            consecutiveOffDays = 0;
          }
      } else {
          consecutiveOffDays = 0;
        }
      }
    }
  });
}

// 간호사별 스케줄 생성
function createNurseSchedule(
  nurse: Nurse, 
  daysInMonth: number[],
  year: number, 
  month: number, 
  constraints: ScheduleConstraints,
  existingSchedule?: { [nurseId: number]: { [day: number]: string } }
): { [day: number]: string } {
  const nurseSchedule: { [day: number]: string } = {};
  
  if (nurse.position === 'HN') {
    // HN 간호사: 평일 D, 주말/공휴일 O (미리 입력된 부분은 보호)
  daysInMonth.forEach(day => {
      const existingWorkType = existingSchedule?.[nurse.id]?.[day];
      
      if (existingWorkType && existingWorkType !== '-') {
        // 미리 입력된 스케줄 보호
        nurseSchedule[day] = existingWorkType;
        console.log(`${nurse.name}: ${day}일 미리 입력된 스케줄 보호 (${existingWorkType})`);
      } else {
        // 새로 스케줄 작성
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        
        if (isHoliday(year, month, day) || dayOfWeek === 0 || dayOfWeek === 6) {
          nurseSchedule[day] = 'O';
        } else {
          nurseSchedule[day] = 'D';
        }
      }
    });
  } else if (nurse.nightDedicated) {
    // 야간전담 간호사: NNOO 패턴 (미리 입력된 부분은 보호)
    daysInMonth.forEach(day => {
      const existingWorkType = existingSchedule?.[nurse.id]?.[day];
      
      if (existingWorkType && existingWorkType !== '-') {
        // 미리 입력된 스케줄 보호
        nurseSchedule[day] = existingWorkType;
        console.log(`${nurse.name}: ${day}일 미리 입력된 스케줄 보호 (${existingWorkType})`);
      } else {
        // 새로 스케줄 작성
        const patternIndex = (day - 1) % 4;
        if (patternIndex < 2) {
          nurseSchedule[day] = 'N';
        } else {
          nurseSchedule[day] = 'O';
        }
      }
    });
    
    // N 근무 다음 OO 제약조건 적용
    for (let i = 0; i < daysInMonth.length - 2; i++) {
      const day = daysInMonth[i];
      const workType = nurseSchedule[day];
      
      if (workType === 'N') {
        const nextDay1 = day + 1;
        const nextDay2 = day + 2;
        
        if (nextDay1 <= daysInMonth.length && nurseSchedule[nextDay1] === '-') {
          nurseSchedule[nextDay1] = 'O';
          console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 자동 O 설정`);
        }
        if (nextDay2 <= daysInMonth.length && nurseSchedule[nextDay2] === '-') {
          nurseSchedule[nextDay2] = 'O';
          console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 자동 O 설정`);
        }
      }
    }
  } else {
    // RN, AN 간호사: 제약 조건을 지키면서 스케줄 작성 (미리 입력된 부분은 보호)
    const rnAnSchedule = createRNANSchedule(nurse, daysInMonth, year, month, constraints, existingSchedule);
    Object.assign(nurseSchedule, rnAnSchedule);
  }
  
  return nurseSchedule;
}

// 공휴일 감지 함수
function isHoliday(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  
  // 주말은 공휴일로 간주
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return true;
  }
  
  // 한국의 주요 공휴일들
  const holidays = [
    { month: 1, day: 1 },   // 신정
    { month: 3, day: 1 },   // 삼일절
    { month: 5, day: 5 },   // 어린이날
    { month: 6, day: 6 },   // 현충일
    { month: 8, day: 15 },  // 광복절
    { month: 10, day: 3 },  // 개천절
    { month: 10, day: 9 },  // 한글날
    { month: 12, day: 25 }, // 성탄절
  ];
  
  // 고정 공휴일 체크
  for (const holiday of holidays) {
    if (month === holiday.month && day === holiday.day) {
      return true;
    }
  }
  
  return false;
}

// RN/AN 간호사 스케줄 생성
function createRNANSchedule(
  nurse: Nurse,
  daysInMonth: number[],
  year: number,
  month: number,
  constraints: ScheduleConstraints,
  existingSchedule?: { [nurseId: number]: { [day: number]: string } }
): { [day: number]: string } {
  const nurseSchedule: { [day: number]: string } = {};
  
  // 1단계: 미리 입력된 스케줄 보호 및 빈 상태로 초기화
    daysInMonth.forEach(day => {
    const existingWorkType = existingSchedule?.[nurse.id]?.[day];
    
    if (existingWorkType && existingWorkType !== '-') {
      // 미리 입력된 스케줄 보호
      nurseSchedule[day] = existingWorkType;
      console.log(`${nurse.name}: ${day}일 미리 입력된 스케줄 보호 (${existingWorkType})`);
      } else {
      // 빈 상태로 초기화
      nurseSchedule[day] = '-';
    }
  });
  
  // 2단계: 최소 휴무일 보장
  const minOffDays = constraints.minDaysOff;
  const totalDays = daysInMonth.length;
  const maxWorkDays = totalDays - minOffDays;
  
  // 3단계: 제약 조건을 지키면서 스케줄 작성
  let workDays = 0;
  let offDays = 0;
  let consecutiveWorkDays = 0;
  let consecutiveOffDays = 0;
  
  for (let day of daysInMonth) {
    // 미리 입력된 스케줄이 있으면 건드리지 않음
    if (nurseSchedule[day] !== '-') {
      // 미리 입력된 스케줄은 그대로 유지하고 카운트만 업데이트
      const workType = nurseSchedule[day];
      if (workType === 'O') {
        offDays++;
        consecutiveOffDays++;
        consecutiveWorkDays = 0;
      } else {
        workDays++;
        consecutiveWorkDays++;
        consecutiveOffDays = 0;
      }
      continue;
    }
    
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHolidayDay = isHoliday(year, month, day);
    
    // 제약 조건 체크 - 더 엄격하게 적용
    const canWork = workDays < maxWorkDays && 
                   consecutiveWorkDays < constraints.maxConsecutiveDays;
    const mustOff = consecutiveOffDays >= (constraints.maxConsecutiveOffDays || 3) ||
                   (workDays >= maxWorkDays) ||
                   consecutiveWorkDays >= constraints.maxConsecutiveDays;
    
    if (mustOff || !canWork) {
// 휴무 배치
      nurseSchedule[day] = 'O';
      offDays++;
      consecutiveOffDays++;
      consecutiveWorkDays = 0;
    } else {
      // 근무 배치 (가능한 근무 유형 중 선택)
      const availableWorkTypes = getAvailableWorkTypes(nurse, day, isWeekend, isHolidayDay);
      
      // 제약사항 적용: N 다음에는 O 2개, E 다음에는 D 금지
      const filteredWorkTypes = applyWorkTypeConstraints(availableWorkTypes, nurseSchedule, day, daysInMonth);
      
      if (filteredWorkTypes.length > 0) {
        // 선호 근무를 고려한 근무 유형 선택
        const selectedWorkType = selectWorkTypeByPreference(filteredWorkTypes, nurse);
        nurseSchedule[day] = selectedWorkType;
        console.log(`${nurse.name}: ${day}일 선호 근무 고려하여 ${selectedWorkType} 배치`);
        
        // N 근무 배치 시 다음 2일을 자동으로 O로 설정
        if (selectedWorkType === 'N') {
          const nextDay1 = day + 1;
          const nextDay2 = day + 2;
          
          if (nextDay1 <= daysInMonth.length && nurseSchedule[nextDay1] === '-') {
            nurseSchedule[nextDay1] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 자동 O 설정`);
            offDays++;
            consecutiveOffDays++;
          }
          if (nextDay2 <= daysInMonth.length && nurseSchedule[nextDay2] === '-') {
            nurseSchedule[nextDay2] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 자동 O 설정`);
            offDays++;
            consecutiveOffDays++;
          }
        }
        
        workDays++;
        consecutiveWorkDays++;
        // N 근무가 아닌 경우에만 consecutiveOffDays 리셋
        if (selectedWorkType !== 'N') {
          consecutiveOffDays = 0;
        }
      } else {
        // 가능한 근무 유형이 없으면 휴무
        nurseSchedule[day] = 'O';
        offDays++;
        consecutiveOffDays++;
        consecutiveWorkDays = 0;
      }
    }
  }
  
  // 4단계: 최소 휴무일 보장 확인 및 조정
  if (offDays < minOffDays) {
    console.log(`${nurse.name}: 최소 휴무일 부족 (${offDays}/${minOffDays}), 추가 조정 필요`);
  }
  
  // 5단계: 제약 조건 검증
  const violations = validateNurseSchedule(nurseSchedule, daysInMonth, constraints);
  if (violations.length > 0) {
    console.log(`${nurse.name} 스케줄 위반사항:`, violations);
  }
  
  // 6단계: 최대 연속 휴무일 초과 시 강제 근무 배치
  const maxConsecutiveOffDays = constraints.maxConsecutiveOffDays || 3;
  let finalConsecutiveOffDays = 0;
  
  for (let i = 0; i < daysInMonth.length; i++) {
    const day = daysInMonth[i];
    const workType = nurseSchedule[day];
    
    if (workType === 'O') {
      finalConsecutiveOffDays++;
      
      // 최대 연속 휴무일 초과 시 강제 근무 배치
      if (finalConsecutiveOffDays > maxConsecutiveOffDays) {
        const workTypes = ['D', 'E', 'N'];
        // M 근무는 AN만 가능
        if (nurse.position === 'AN') {
          workTypes.push('M');
        }
        // 선호 근무를 고려한 강제 근무 배치
        const selectedWorkType = selectWorkTypeByPreference(workTypes, nurse);
        nurseSchedule[day] = selectedWorkType;
        console.log(`${nurse.name}: 최대 연속 휴무일 초과로 ${day}일 강제 ${selectedWorkType} 배치 (선호 근무 고려)`);
        finalConsecutiveOffDays = 0;
      }
    } else {
      finalConsecutiveOffDays = 0;
    }
  }
  
  return nurseSchedule;
}

// 간호사가 특정 날짜에 가능한 근무 유형 반환
function getAvailableWorkTypes(
  nurse: Nurse, 
  day: number,
  isWeekend: boolean, 
  isHoliday: boolean
): string[] {
  const availableTypes: string[] = [];
  
  // 간호사의 근무 가능 유형 체크
  if (nurse.workAvailability.D) availableTypes.push('D');
  if (nurse.workAvailability.E) availableTypes.push('E');
  if (nurse.workAvailability.N) availableTypes.push('N');
  // M 근무는 AN만 가능
  if (nurse.workAvailability.M && nurse.position === 'AN') availableTypes.push('M');
  
  // 주말/공휴일에는 특정 근무 유형 제한 (필요시)
  if (isWeekend || isHoliday) {
    // 주말/공휴일에도 모든 근무 유형 가능 (간호사 특성상)
    return availableTypes;
  }
  
  return availableTypes;
}

// 간호사의 선호 근무를 고려한 근무 유형 선택
function selectWorkTypeByPreference(
  availableWorkTypes: string[],
  nurse: Nurse
): string {
  if (availableWorkTypes.length === 0) return 'O';
  if (availableWorkTypes.length === 1) return availableWorkTypes[0];
  
  // 간호사의 선호 근무 확인
  const preferences = nurse.workAvailability;
  
  // 선호 근무만 필터링
  const preferredTypes = availableWorkTypes.filter(workType => {
    switch (workType) {
      case 'D': return preferences.D;
      case 'E': return preferences.E;
      case 'N': return preferences.N;
      case 'M': return preferences.M;
      default: return false;
    }
  });
  
  // 선호 근무가 있으면 그 중에서 선택
  if (preferredTypes.length > 0) {
    return selectWorkTypeByPriority(preferredTypes, nurse);
  }
  
  // 선호 근무가 없으면 모든 가능한 근무 중에서 선택
  return selectWorkTypeByPriority(availableWorkTypes, nurse);
}

// 우선순위에 따른 근무 유형 선택
function selectWorkTypeByPriority(
  workTypes: string[],
  nurse: Nurse
): string {
  if (workTypes.length === 0) return 'O';
  if (workTypes.length === 1) return workTypes[0];
  
  // RN과 AN의 우선순위 비율 적용
  let weightedTypes: string[] = [];
  
  if (nurse.position === 'RN') {
    // RN: D:E:N = 5:3:2
    workTypes.forEach(type => {
      switch (type) {
        case 'D':
          weightedTypes.push(...Array(5).fill('D'));
          break;
        case 'E':
          weightedTypes.push(...Array(3).fill('E'));
          break;
        case 'N':
          weightedTypes.push(...Array(2).fill('N'));
          break;
        default:
          weightedTypes.push(type);
      }
    });
  } else if (nurse.position === 'AN') {
    // AN: D:E:N:M = 3:2:2:4
    workTypes.forEach(type => {
      switch (type) {
        case 'D':
          weightedTypes.push(...Array(3).fill('D'));
          break;
        case 'E':
          weightedTypes.push(...Array(2).fill('E'));
          break;
        case 'N':
          weightedTypes.push(...Array(2).fill('N'));
          break;
        case 'M':
          weightedTypes.push(...Array(4).fill('M'));
          break;
        default:
          weightedTypes.push(type);
      }
    });
  } else {
    // HN은 기존 로직 유지
    return workTypes[Math.floor(Math.random() * workTypes.length)];
  }
  
  // 가중치가 적용된 배열에서 랜덤 선택
  return weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
}

// 근무 유형 제약사항 적용
function applyWorkTypeConstraints(
  availableWorkTypes: string[],
  nurseSchedule: { [day: number]: string },
  currentDay: number,
  daysInMonth: number[]
): string[] {
  const filteredTypes: string[] = [];
  
  for (const workType of availableWorkTypes) {
    let isValid = true;
    
    // 1. N 다음에는 O 2개가 와야 함
    if (workType === 'N') {
      // 다음 2일이 모두 비어있거나 O로 설정 가능한지 확인
      const nextDay1 = currentDay + 1;
      const nextDay2 = currentDay + 2;
      
      if (nextDay1 <= daysInMonth.length && nextDay2 <= daysInMonth.length) {
        const nextDay1Schedule = nurseSchedule[nextDay1];
        const nextDay2Schedule = nurseSchedule[nextDay2];
        
        // 다음 2일이 이미 다른 근무로 배정되어 있으면 N 배치 불가
        if ((nextDay1Schedule && nextDay1Schedule !== '-' && nextDay1Schedule !== 'O') ||
            (nextDay2Schedule && nextDay2Schedule !== '-' && nextDay2Schedule !== 'O')) {
          isValid = false;
          console.log(`N 근무 제약: ${nextDay1}일 또는 ${nextDay2}일이 이미 배정되어 N 배치 불가`);
        }
      }
    }
    
    // 2. E 다음에는 D가 와서는 안됨
    if (workType === 'D') {
      // 이전 날이 E인지 확인
      const prevDay = currentDay - 1;
      if (prevDay >= 1) {
        const prevDaySchedule = nurseSchedule[prevDay];
        if (prevDaySchedule === 'E') {
          isValid = false;
          console.log(`E-D 제약: ${prevDay}일이 E이므로 ${currentDay}일은 D 배치 불가`);
        }
      }
    }
    
    if (isValid) {
      filteredTypes.push(workType);
    }
  }
  
  return filteredTypes;
}

// 간호사 스케줄 제약 조건 검증
function validateNurseSchedule(
  nurseSchedule: { [day: number]: string },
  daysInMonth: number[],
  constraints: ScheduleConstraints
): string[] {
  const violations: string[] = [];
  
  // 1. 최대 연속 근무일 검증
  let maxConsecutiveWork = 0;
  let currentConsecutiveWork = 0;
    
    daysInMonth.forEach(day => {
    const workType = nurseSchedule[day];
      if (workType !== 'O' && workType !== '-') {
      currentConsecutiveWork++;
      maxConsecutiveWork = Math.max(maxConsecutiveWork, currentConsecutiveWork);
      } else {
      currentConsecutiveWork = 0;
    }
  });
  
  if (maxConsecutiveWork > constraints.maxConsecutiveDays) {
    violations.push(`최대 연속 근무일 초과: ${maxConsecutiveWork}일 (제한: ${constraints.maxConsecutiveDays}일)`);
  }
  
  // 2. 최대 연속 휴무일 검증
  let maxConsecutiveOff = 0;
  let currentConsecutiveOff = 0;
  
  daysInMonth.forEach(day => {
    const workType = nurseSchedule[day];
    if (workType === 'O') {
      currentConsecutiveOff++;
      maxConsecutiveOff = Math.max(maxConsecutiveOff, currentConsecutiveOff);
    } else {
      currentConsecutiveOff = 0;
    }
  });
  
  const maxOffDays = constraints.maxConsecutiveOffDays || 3;
  if (maxConsecutiveOff > maxOffDays) {
    violations.push(`최대 연속 휴무일 초과: ${maxConsecutiveOff}일 (제한: ${maxOffDays}일)`);
  }
  
  // 3. 최소 휴무일 검증
  const offDays = daysInMonth.filter(day => nurseSchedule[day] === 'O').length;
  if (offDays < constraints.minDaysOff) {
    violations.push(`최소 휴무일 부족: ${offDays}일 (필요: ${constraints.minDaysOff}일)`);
  }
  
  // 4. N 다음 O 2개 제약사항 검증
  for (let i = 0; i < daysInMonth.length - 2; i++) {
    const day = daysInMonth[i];
    const workType = nurseSchedule[day];
    
    if (workType === 'N') {
      const nextDay1 = nurseSchedule[day + 1];
      const nextDay2 = nurseSchedule[day + 2];
      
      if (nextDay1 !== 'O' || nextDay2 !== 'O') {
        violations.push(`N 근무 제약 위반: ${day}일 N 근무 후 ${day + 1}일, ${day + 2}일이 O가 아님`);
      }
    }
  }
  
  // 5. E 다음 D 금지 제약사항 검증
  for (let i = 1; i < daysInMonth.length; i++) {
    const prevDay = nurseSchedule[daysInMonth[i - 1]];
    const currentDay = nurseSchedule[daysInMonth[i]];
    
    if (prevDay === 'E' && currentDay === 'D') {
      violations.push(`E-D 제약 위반: ${daysInMonth[i - 1]}일 E 근무 후 ${daysInMonth[i]}일 D 근무`);
    }
  }
  
  return violations;
}