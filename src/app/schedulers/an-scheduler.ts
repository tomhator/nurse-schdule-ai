// AN 간호사 스케줄링 로직

import { Nurse, ScheduleConstraints } from '../types';
import { isHoliday } from '../utils/date-utils';
import { getAvailableWorkTypes } from '../utils/nurse-utils';
import { selectWorkTypeByPreference } from '../utils/work-selection';
import { applyWorkTypeConstraints } from '../utils/schedule-utils';

// AN 간호사들의 일/월/목 N근무 배치 처리
export function applyANWeeklyNSchedule(
  anNurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  year: number,
  month: number
): void {
  console.log('=== AN 간호사 일/월/목 N근무 배치 처리 ===');
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
export function createANSchedule(
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
  const maxWorkDays = totalDays - minOffDays; // 최대 근무일수 = 총 일수 - 최소 휴무일
  const minWorkDays = totalDays - (minOffDays + 2); // 최소 근무일수 = 총 일수 - (최소 휴무일 + 2)
  
  console.log(`${nurse.name}: AN 월별 근무일수 제한 - 최대: ${maxWorkDays}일, 최소: ${minWorkDays}일`);
  
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
    
    console.log(`${nurse.name} ${day}일: canWork=${canWork}, mustOff=${mustOff}, consecutiveWorkDays=${consecutiveWorkDays}, maxConsecutiveDays=${constraints.maxConsecutiveDays}`);
    
    if (mustOff || !canWork) {
      // 휴무 배치
      nurseSchedule[day] = 'O';
      offDays++;
      consecutiveOffDays++;
      consecutiveWorkDays = 0;
      console.log(`${nurse.name}: ${day}일 휴무 배치 (mustOff=${mustOff}, canWork=${canWork})`);
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
  
  // 3단계: 최소 근무일수 보장 확인 및 조정
  if (workDays < minWorkDays) {
    console.log(`${nurse.name}: AN 최소 근무일수 부족 (${workDays}/${minWorkDays}), 강제 근무 배치 시작`);
    
    // 최소 근무일수 미달 시 강제 근무 배치
    const neededWorkDays = minWorkDays - workDays;
    let addedWorkDays = 0;
    
    for (let i = 0; i < daysInMonth.length && addedWorkDays < neededWorkDays; i++) {
      const day = daysInMonth[i];
      
      // 빈 스케줄이거나 휴무인 경우에만 근무로 변경
      if (nurseSchedule[day] === '-' || nurseSchedule[day] === 'O') {
        const availableWorkTypes = getAvailableWorkTypes(nurse, day, false, false);
        const filteredWorkTypes = applyWorkTypeConstraints(availableWorkTypes, nurseSchedule, day, daysInMonth);
        
        if (filteredWorkTypes.length > 0) {
          const selectedWorkType = selectWorkTypeByPreference(filteredWorkTypes, nurse);
          nurseSchedule[day] = selectedWorkType;
          addedWorkDays++;
          workDays++;
          offDays--;
          
          console.log(`${nurse.name}: AN 최소 근무일수 보장을 위해 ${day}일 ${selectedWorkType} 강제 배치`);
          
          // N 근무 배치 시 다음 2일 O 설정
          if (selectedWorkType === 'N') {
            const nextDay1 = day + 1;
            const nextDay2 = day + 2;
            
            if (nextDay1 <= daysInMonth.length && nurseSchedule[nextDay1] === '-') {
              nurseSchedule[nextDay1] = 'O';
              offDays++;
            }
            if (nextDay2 <= daysInMonth.length && nurseSchedule[nextDay2] === '-') {
              nurseSchedule[nextDay2] = 'O';
              offDays++;
            }
          }
        }
      }
    }
    
    console.log(`${nurse.name}: AN 최소 근무일수 보장 완료 - 추가 근무: ${addedWorkDays}일`);
  }
  
  // 4단계: 최소 휴무일 보장 확인 및 조정
  if (offDays < minOffDays) {
    console.log(`${nurse.name}: 최소 휴무일 부족 (${offDays}/${minOffDays}), 추가 조정 필요`);
  }
  
  console.log(`=== ${nurse.name} AN 스케줄 생성 완료 ===`);
  return nurseSchedule;
}
