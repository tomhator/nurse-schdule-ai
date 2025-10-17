// 야간전담 간호사 스케줄링 로직

import { Nurse } from '../types';

// 야간전담 간호사들의 교차 배정 처리
export function applyNightDedicatedAlternatingSchedule(
  nightDedicatedNurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  _year: number,
  _month: number
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
export function applySingleNightDedicatedSchedule(
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

// 야간전담 간호사 NNOO 패턴 강제 적용 (휴무일 제한 무시)
export function enforceNightDedicatedNNOOPattern(
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

// 야간전담 간호사 D/E 근무 제거
export function removeNightDedicatedDEWork(
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
