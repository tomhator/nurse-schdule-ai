// RN 간호사 스케줄링 로직

import { Nurse, ScheduleConstraints } from '../types';
import { isHoliday } from '../utils/date-utils';
import { getAvailableWorkTypes } from '../utils/nurse-utils';
import { selectWorkTypeByPreference } from '../utils/work-selection';
import { applyWorkTypeConstraints } from '../utils/schedule-utils';

// RN 교대 휴무 배치: 기존 O를 보존하면서, 비어있는 날에는 RN들이 번갈아 O를 갖도록 선배치
export function applyRNAlternateOffPattern(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): void {
  const rnNurses = nurses.filter(n => n.position === 'RN' && !n.nightDedicated);
  if (rnNurses.length === 0) return;

  // 라운드로빈 인덱스는 기존 O가 적은 간호사부터 시작
  const countO = (nId: number) => daysInMonth.filter(d => schedule[nId]?.[d] === 'O').length;
  rnNurses.sort((a, b) => countO(a.id) - countO(b.id));
  let rr = 0;

  daysInMonth.forEach(day => {
    // 이미 누가 O면 그날은 스킵 (기존 O 보존)
    const alreadyHasO = rnNurses.some(n => schedule[n.id]?.[day] === 'O');
    if (alreadyHasO) return;

    // 배정 가능한 RN 찾기: 비어있거나('-') 당일 배정 전 상태인 간호사 중에서 선택
    for (let t = 0; t < rnNurses.length; t++) {
      const idx = (rr + t) % rnNurses.length;
      const nurse = rnNurses[idx];
      const cur = schedule[nurse.id]?.[day];
      if (cur === '-' || cur === undefined) {
        // 전전/전일 N이면 오늘은 O여야 하므로 굳이 여기서 O를 배치해도 무해
        schedule[nurse.id][day] = 'O';
        rr = (idx + 1) % rnNurses.length;
        return;
      }
    }
    // 모두 채워져 있으면 패스
  });
}

// RN 간호사 스케줄 생성 (AN 분리)
export function createRNSchedule(
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
  
  // 2단계: 월별 근무일수 제한 설정
  const minOffDays = constraints.minDaysOff;
  const totalDays = daysInMonth.length;
  const maxWorkDays = totalDays - minOffDays; // 최대 근무일수 = 총 일수 - 최소 휴무일
  const minWorkDays = totalDays - (minOffDays + 2); // 최소 근무일수 = 총 일수 - (최소 휴무일 + 2)
  
  console.log(`${nurse.name}: 월별 근무일수 제한 - 최대: ${maxWorkDays}일, 최소: ${minWorkDays}일`);
  
  // RN의 N근무 제한 (월 최대 1회)
  let rnNWorkCount = 0;
  const maxRNNWork = 1;
  
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
    
    // RN의 N근무 제한 체크
    const canAssignN = !(nurse.position === 'RN' && rnNWorkCount >= maxRNNWork);
    
    console.log(`${nurse.name} ${day}일: canWork=${canWork}, mustOff=${mustOff}, consecutiveWorkDays=${consecutiveWorkDays}, maxConsecutiveDays=${constraints.maxConsecutiveDays}`);
    
    if (mustOff || !canWork) {
      // 휴무 배치
      nurseSchedule[day] = 'O';
      offDays++;
      consecutiveOffDays++;
      consecutiveWorkDays = 0;
      console.log(`${nurse.name}: ${day}일 휴무 배치 (mustOff=${mustOff}, canWork=${canWork})`);
    } else {
      // 근무 배치 (가능한 근무 유형 중 선택)
      const availableWorkTypes = getAvailableWorkTypes(nurse, day, isWeekend, isHolidayDay);
      
      // 제약사항 적용: N 다음에는 O 2개, E 다음에는 D 금지
      let filteredWorkTypes = applyWorkTypeConstraints(availableWorkTypes, nurseSchedule, day, daysInMonth);
      
      // RN의 N근무 제한 적용
      if (nurse.position === 'RN' && !canAssignN) {
        filteredWorkTypes = filteredWorkTypes.filter(workType => workType !== 'N');
        console.log(`${nurse.name}: RN N근무 제한으로 N 제외 (현재 ${rnNWorkCount}/${maxRNNWork})`);
      }
      
      if (filteredWorkTypes.length > 0) {
        // 선호 근무를 고려한 근무 유형 선택
        const selectedWorkType = selectWorkTypeByPreference(filteredWorkTypes, nurse);
        nurseSchedule[day] = selectedWorkType;
        console.log(`${nurse.name}: ${day}일 선호 근무 고려하여 ${selectedWorkType} 배치`);
        
        // N 근무 배치 시 다음 2일을 자동으로 O로 설정
        if (selectedWorkType === 'N') {
          // RN의 N근무 카운트 증가
          if (nurse.position === 'RN') {
            rnNWorkCount++;
            console.log(`${nurse.name}: RN N근무 카운트 증가 (${rnNWorkCount}/${maxRNNWork})`);
          }
          
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
  
  // 4단계: 최소 근무일수 보장 확인 및 조정
  if (workDays < minWorkDays) {
    console.log(`${nurse.name}: 최소 근무일수 부족 (${workDays}/${minWorkDays}), 강제 근무 배치 시작`);
    
    // 최소 근무일수 미달 시 강제 근무 배치
    const neededWorkDays = minWorkDays - workDays;
    let addedWorkDays = 0;
    
    for (let i = 0; i < daysInMonth.length && addedWorkDays < neededWorkDays; i++) {
      const day = daysInMonth[i];
      
      // 빈 스케줄이거나 휴무인 경우에만 근무로 변경
      if (nurseSchedule[day] === '-' || nurseSchedule[day] === 'O') {
        const availableWorkTypes = getAvailableWorkTypes(nurse, day, false, false);
        const filteredWorkTypes = applyWorkTypeConstraints(availableWorkTypes, nurseSchedule, day, daysInMonth);
        
        // RN의 N근무 제한 적용
        let finalWorkTypes = filteredWorkTypes;
        if (nurse.position === 'RN' && rnNWorkCount >= maxRNNWork) {
          finalWorkTypes = filteredWorkTypes.filter(workType => workType !== 'N');
        }
        
        if (finalWorkTypes.length > 0) {
          const selectedWorkType = selectWorkTypeByPreference(finalWorkTypes, nurse);
          nurseSchedule[day] = selectedWorkType;
          addedWorkDays++;
          workDays++;
          offDays--;
          
          console.log(`${nurse.name}: 최소 근무일수 보장을 위해 ${day}일 ${selectedWorkType} 강제 배치`);
          
          // N 근무 배치 시 카운트 증가 및 다음 2일 O 설정
          if (selectedWorkType === 'N') {
            if (nurse.position === 'RN') {
              rnNWorkCount++;
            }
            
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
    
    console.log(`${nurse.name}: 최소 근무일수 보장 완료 - 추가 근무: ${addedWorkDays}일`);
  }
  
  // 5단계: 최소 휴무일 보장 확인 및 조정
  if (offDays < minOffDays) {
    console.log(`${nurse.name}: 최소 휴무일 부족 (${offDays}/${minOffDays}), 추가 조정 필요`);
  }
  
  return nurseSchedule;
}

// RN 스케줄 조건 적용
export function applyRNScheduleConditions(
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
    
    // 1. RN이 모두 O인지 확인 (무조건 한 명은 근무해야 함)
    const rnWorkTypes = rnNurses.map(nurse => schedule[nurse.id][day]);
    const allOff = rnWorkTypes.every(workType => workType === 'O' || workType === '-');
    
    if (allOff) {
      console.log(`${day}일: RN이 모두 O - 무조건 최소 1명 근무 배치 필요 (필수 제약조건)`);
      
      // 최소 1명의 RN을 근무로 배치 (무조건 적용)
      const availableRNs = rnNurses.filter(nurse => {
        const existingSchedule = schedule[nurse.id][day];
        return !existingSchedule || existingSchedule === '-' || existingSchedule === 'O';
      });
      
      if (availableRNs.length > 0) {
        // 첫 번째 RN을 D 근무로 배치 (무조건 적용)
        const selectedRN = availableRNs[0];
        schedule[selectedRN.id][day] = 'D';
        console.log(`${selectedRN.name}: ${day}일 D 근무 강제 배치 (RN 무조건 1명 근무 필수)`);
      } else {
        // 모든 RN이 미리 입력된 스케줄이 있는 경우, 강제로 변경
        console.log(`${day}일: 모든 RN이 미리 입력된 스케줄 - 강제 변경 필요`);
        const firstRN = rnNurses[0];
        schedule[firstRN.id][day] = 'D';
        console.log(`${firstRN.name}: ${day}일 강제 D 근무 배치 (RN 무조건 1명 근무 필수)`);
      }
    }
    
    // 1-1. RN 근무자 수 재확인 (추가 검증)
    const finalRnWorkers = rnNurses.filter(nurse => {
      const workType = schedule[nurse.id][day];
      return workType && workType !== 'O' && workType !== '-';
    });
    
    if (finalRnWorkers.length === 0) {
      console.log(`${day}일: RN 근무자 0명 - 강제 근무 배치 재시도`);
      // 다시 한 번 강제로 RN 1명 배치
      const selectedRN = rnNurses[0];
      schedule[selectedRN.id][day] = 'D';
      console.log(`${selectedRN.name}: ${day}일 최종 강제 D 근무 배치 (RN 무조건 1명 근무 필수)`);
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
    const finalRnWorkersCount = rnNurses.filter(nurse => {
      const workType = schedule[nurse.id][day];
      return workType && workType !== 'O' && workType !== '-';
    });
    
    const finalEWorkers = finalRnWorkersCount.filter(nurse => schedule[nurse.id][day] === 'E');
    
    console.log(`${day}일: RN 근무자 ${finalRnWorkersCount.length}명 (E 근무자 ${finalEWorkers.length}명)`);
  });
}
