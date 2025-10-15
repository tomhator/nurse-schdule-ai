// HN 간호사 스케줄링 로직

import { Nurse, ScheduleConstraints } from '../types';
import { isHoliday } from '../utils/date-utils';

// HN 간호사 스케줄 생성
export function createHNSchedule(
  nurse: Nurse, 
  daysInMonth: number[],
  year: number, 
  month: number, 
  existingSchedule?: { [nurseId: number]: { [day: number]: string } }
): { [day: number]: string } {
  const nurseSchedule: { [day: number]: string } = {};
  
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
  
  return nurseSchedule;
}

// HN 간호사 스케줄 보호 및 강제 적용
export function enforceHNSchedule(
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
