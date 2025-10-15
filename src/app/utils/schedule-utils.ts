// 스케줄 관련 유틸리티 함수들

import { Nurse } from '../types';

// 현재 근무표를 2차원 배열로 저장
export function saveCurrentScheduleToArray(
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

// 근무 유형 제약사항 적용
export function applyWorkTypeConstraints(
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
