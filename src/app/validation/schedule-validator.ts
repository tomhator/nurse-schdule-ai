// 스케줄 최종 검증 로직

import { Nurse, ScheduleConstraints } from '../types';

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  warnings: string[];
}

// 스케줄 최종 검증
export function validateFinalSchedule(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints,
  year: number,
  month: number
): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  console.log('=== 최종 스케줄 검증 시작 ===');

  // 1. RN 무조건 1명 근무 검증
  validateRNMinimumWork(nurses, schedule, daysInMonth, violations);

  // 2. HN 스케줄 규칙 검증
  validateHNSchedule(nurses, schedule, daysInMonth, year, month, violations);

  // 3. 야간전담 간호사 NNOO 패턴 검증
  validateNightDedicatedPattern(nurses, schedule, daysInMonth, violations);

  // 4. 연속근무일/연속휴무일 제약조건 검증
  validateConsecutiveWorkOffLimits(nurses, schedule, daysInMonth, constraints, violations);

  // 5. N-OO 제약조건 검증
  validateNOOConstraint(nurses, schedule, daysInMonth, violations);

  // 6. E-D 근무 금지 검증
  validateEDProhibition(nurses, schedule, daysInMonth, violations);

  // 7. RN E근무 1명 제한 검증
  validateRNEWorkLimit(nurses, schedule, daysInMonth, violations);

  // 8. AN N근무 일/월/목 제한 검증
  validateANNWorkDays(nurses, schedule, daysInMonth, year, month, violations);

  // 9. 월별 근무일수 검증
  validateMonthlyWorkDays(nurses, schedule, daysInMonth, constraints, violations);

  // 10. 최대 OFF 개수 검증
  validateMaxOffDays(nurses, schedule, daysInMonth, constraints, violations);

  const isValid = violations.length === 0;

  console.log(`=== 최종 스케줄 검증 완료 ===`);
  console.log(`검증 결과: ${isValid ? '통과' : '실패'}`);
  console.log(`위반사항: ${violations.length}개`);
  console.log(`경고사항: ${warnings.length}개`);

  if (violations.length > 0) {
    console.log('위반사항 목록:');
    violations.forEach((violation, index) => {
      console.log(`${index + 1}. ${violation}`);
    });
  }

  return {
    isValid,
    violations,
    warnings
  };
}

// RN 무조건 1명 근무 검증
function validateRNMinimumWork(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  violations: string[]
): void {
  console.log('=== RN 무조건 1명 근무 검증 ===');
  
  const rnNurses = nurses.filter(nurse => nurse.position === 'RN' && !nurse.nightDedicated);
  
  if (rnNurses.length === 0) {
    console.log('RN 간호사가 없습니다.');
    return;
  }

  daysInMonth.forEach(day => {
    const rnWorkers = rnNurses.filter(nurse => {
      const workType = schedule[nurse.id][day];
      return workType && workType !== 'O' && workType !== '-';
    });

    if (rnWorkers.length === 0) {
      violations.push(`${day}일: RN 간호사가 모두 휴무입니다. (무조건 1명 이상 근무 필요)`);
    }
  });
}

// HN 스케줄 규칙 검증
function validateHNSchedule(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  year: number,
  month: number,
  violations: string[]
): void {
  console.log('=== HN 스케줄 규칙 검증 ===');
  
  const hnNurses = nurses.filter(nurse => nurse.position === 'HN');
  
  hnNurses.forEach(nurse => {
    daysInMonth.forEach(day => {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const isHolidayDay = isHoliday(year, month, day);
      const workType = schedule[nurse.id][day];
      
      // HN 규칙: 평일 D, 주말/공휴일 O
      if (isHolidayDay || dayOfWeek === 0 || dayOfWeek === 6) {
        if (workType !== 'O') {
          violations.push(`${nurse.name} ${day}일: 주말/공휴일인데 ${workType} 근무입니다. (O 근무 필요)`);
        }
      } else {
        if (workType !== 'D') {
          violations.push(`${nurse.name} ${day}일: 평일인데 ${workType} 근무입니다. (D 근무 필요)`);
        }
      }
    });
  });
}

// 야간전담 간호사 NNOO 패턴 검증
function validateNightDedicatedPattern(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  violations: string[]
): void {
  console.log('=== 야간전담 간호사 NNOO 패턴 검증 ===');
  
  const nightDedicatedNurses = nurses.filter(nurse => nurse.nightDedicated);
  
  nightDedicatedNurses.forEach((nurse, nurseIndex) => {
    // NNOO 패턴 검증 (4일 주기)
    for (let i = 0; i < daysInMonth.length; i += 4) {
      const patternStart = (nurseIndex % 2) * 2; // 0, 2, 0, 2...
      
      for (let j = 0; j < 4 && i + j < daysInMonth.length; j++) {
        const day = daysInMonth[i + j];
        const dayInPattern = (j + patternStart) % 4;
        const expectedWorkType = dayInPattern < 2 ? 'N' : 'O';
        const actualWorkType = schedule[nurse.id][day];
        
        if (actualWorkType !== expectedWorkType) {
          violations.push(`${nurse.name} ${day}일: NNOO 패턴 위반 (예상: ${expectedWorkType}, 실제: ${actualWorkType})`);
        }
      }
    }
  });
}

// 연속근무일/연속휴무일 제약조건 검증
function validateConsecutiveWorkOffLimits(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints,
  violations: string[]
): void {
  console.log('=== 연속근무일/연속휴무일 제약조건 검증 ===');
  
  nurses.forEach(nurse => {
    // 야간전담 간호사는 제외
    if (nurse.nightDedicated) return;
    
    let consecutiveWorkDays = 0;
    let consecutiveOffDays = 0;
    let maxConsecutiveWork = 0;
    let maxConsecutiveOff = 0;
    
    daysInMonth.forEach(day => {
      const workType = schedule[nurse.id][day];
      
      if (workType && workType !== 'O' && workType !== '-') {
        consecutiveWorkDays++;
        consecutiveOffDays = 0;
        maxConsecutiveWork = Math.max(maxConsecutiveWork, consecutiveWorkDays);
      } else if (workType === 'O') {
        consecutiveOffDays++;
        consecutiveWorkDays = 0;
        maxConsecutiveOff = Math.max(maxConsecutiveOff, consecutiveOffDays);
      } else {
        consecutiveWorkDays = 0;
        consecutiveOffDays = 0;
      }
    });
    
    if (maxConsecutiveWork > constraints.maxConsecutiveDays) {
      violations.push(`${nurse.name}: 최대 연속근무일 초과 (${maxConsecutiveWork}일 > ${constraints.maxConsecutiveDays}일)`);
    }
    
    const maxOffDays = constraints.maxConsecutiveOffDays || 3;
    if (maxConsecutiveOff > maxOffDays) {
      violations.push(`${nurse.name}: 최대 연속휴무일 초과 (${maxConsecutiveOff}일 > ${maxOffDays}일)`);
    }
  });
}

// N-OO 제약조건 검증
function validateNOOConstraint(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  violations: string[]
): void {
  console.log('=== N-OO 제약조건 검증 ===');
  
  nurses.forEach(nurse => {
    for (let i = 0; i < daysInMonth.length - 2; i++) {
      const day = daysInMonth[i];
      const workType = schedule[nurse.id][day];
      
      if (workType === 'N') {
        const nextDay1 = schedule[nurse.id][day + 1];
        const nextDay2 = schedule[nurse.id][day + 2];
        
        if (nextDay1 !== 'O' || nextDay2 !== 'O') {
          violations.push(`${nurse.name} ${day}일: N 근무 후 ${day + 1}일(${nextDay1}), ${day + 2}일(${nextDay2})이 O가 아닙니다.`);
        }
      }
    }
  });
}

// E-D 근무 금지 검증
function validateEDProhibition(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  violations: string[]
): void {
  console.log('=== E-D 근무 금지 검증 ===');
  
  nurses.forEach(nurse => {
    for (let i = 1; i < daysInMonth.length; i++) {
      const prevDay = daysInMonth[i - 1];
      const currentDay = daysInMonth[i];
      const prevWorkType = schedule[nurse.id][prevDay];
      const currentWorkType = schedule[nurse.id][currentDay];
      
      if (prevWorkType === 'E' && currentWorkType === 'D') {
        violations.push(`${nurse.name} ${prevDay}일 E 근무 후 ${currentDay}일 D 근무는 금지됩니다.`);
      }
    }
  });
}

// RN E근무 1명 제한 검증
function validateRNEWorkLimit(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  violations: string[]
): void {
  console.log('=== RN E근무 1명 제한 검증 ===');
  
  const rnNurses = nurses.filter(nurse => nurse.position === 'RN' && !nurse.nightDedicated);
  
  daysInMonth.forEach(day => {
    const eWorkers = rnNurses.filter(nurse => schedule[nurse.id][day] === 'E');
    
    if (eWorkers.length > 1) {
      violations.push(`${day}일: RN E 근무자 ${eWorkers.length}명 (1명만 허용)`);
    }
  });
}

// AN N근무 일/월/목 제한 검증
function validateANNWorkDays(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  year: number,
  month: number,
  violations: string[]
): void {
  console.log('=== AN N근무 일/월/목 제한 검증 ===');
  
  const anNurses = nurses.filter(nurse => nurse.position === 'AN' && !nurse.nightDedicated);
  
  daysInMonth.forEach(day => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const isTargetDay = dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 4; // 일/월/목
    
    const nWorkers = anNurses.filter(nurse => schedule[nurse.id][day] === 'N');
    
    if (isTargetDay) {
      if (nWorkers.length > 1) {
        violations.push(`${day}일: AN N 근무자 ${nWorkers.length}명 (1명만 허용)`);
      }
    } else {
      if (nWorkers.length > 0) {
        violations.push(`${day}일: AN N 근무가 일/월/목이 아닌 날에 배정됨 (${nWorkers.length}명)`);
      }
    }
  });
}

// 월별 근무일수 검증
function validateMonthlyWorkDays(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints,
  violations: string[]
): void {
  console.log('=== 월별 근무일수 검증 ===');
  
  nurses.forEach(nurse => {
    // 야간전담 간호사는 제외
    if (nurse.nightDedicated) return;
    
    let workDays = 0;
    let offDays = 0;
    
    daysInMonth.forEach(day => {
      const workType = schedule[nurse.id][day];
      if (workType === 'O') {
        offDays++;
      } else if (workType && workType !== '-') {
        workDays++;
      }
    });
    
    const totalDays = daysInMonth.length;
    const maxWorkDays = totalDays - constraints.minDaysOff;
    const minWorkDays = totalDays - (constraints.minDaysOff + 2);
    
    if (workDays > maxWorkDays) {
      violations.push(`${nurse.name}: 최대 근무일수 초과 (${workDays}일 > ${maxWorkDays}일)`);
    }
    
    if (workDays < minWorkDays) {
      violations.push(`${nurse.name}: 최소 근무일수 미달 (${workDays}일 < ${minWorkDays}일)`);
    }
    
    if (offDays < constraints.minDaysOff) {
      violations.push(`${nurse.name}: 최소 휴무일 부족 (${offDays}일 < ${constraints.minDaysOff}일)`);
    }
  });
}

// 최대 OFF 개수 검증
function validateMaxOffDays(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints,
  violations: string[]
): void {
  console.log('=== 최대 OFF 개수 검증 ===');
  
  nurses.forEach(nurse => {
    // 야간전담 간호사는 제외
    if (nurse.nightDedicated) return;
    
    let offDays = 0;
    daysInMonth.forEach(day => {
      if (schedule[nurse.id][day] === 'O') {
        offDays++;
      }
    });
    
    const maxAllowedOffDays = constraints.minDaysOff + 2;
    
    if (offDays > maxAllowedOffDays) {
      violations.push(`${nurse.name}: 최대 OFF 개수 초과 (${offDays}일 > ${maxAllowedOffDays}일)`);
    }
  });
}

// 공휴일 감지 함수 (기존 함수와 동일)
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
