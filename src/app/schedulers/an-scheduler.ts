// AN 스케줄링 (RN 규칙 참고, 기존 코드는 삭제)

import { Nurse, ScheduleConstraints } from '../types';
import { isHoliday } from '../utils/date-utils';
import { getAvailableWorkTypes } from '../utils/nurse-utils';
import { selectWorkTypeByPreference } from '../utils/work-selection';
import { applyWorkTypeConstraints } from '../utils/schedule-utils';

// AN 교대 휴무 선배치: 저장된 O 보존 + 라운드로빈 O 분배
export function applyANAlternateOffPattern(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): void {
  const anNurses = nurses.filter(n => n.position === 'AN');
  if (anNurses.length === 0) return;

  const countO = (nId: number) => daysInMonth.filter(d => schedule[nId]?.[d] === 'O').length;
  anNurses.sort((a, b) => countO(a.id) - countO(b.id));
  let rr = 0;

  daysInMonth.forEach(day => {
    const alreadyHasO = anNurses.some(n => schedule[n.id]?.[day] === 'O');
    if (alreadyHasO) return;

    for (let t = 0; t < anNurses.length; t++) {
      const idx = (rr + t) % anNurses.length;
      const nurse = anNurses[idx];
      const cur = schedule[nurse.id]?.[day];
      if (cur === '-' || cur === undefined) {
        schedule[nurse.id][day] = 'O';
        rr = (idx + 1) % anNurses.length;
        return;
      }
    }
  });
}

// AN 간호사들의 일/월/목 N근무 시프트 배정
export function applyANWeeklyNSchedule(
  anNurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  year: number,
  month: number
): void {
  console.log('=== AN 간호사 일/월/목 N근무 시프트 배정 ===');
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
  
  // N 근무 개수를 완전히 동일하게 배정
  const totalNDays = targetDays.length;
  const nursesCount = availableANNurses.length;
  const baseNDays = Math.floor(totalNDays / nursesCount);
  
  console.log(`총 N근무일: ${totalNDays}, AN 수: ${nursesCount}`);
  console.log(`기본 N근무일: ${baseNDays}`);
  
  // 각 AN의 목표 N 근무 개수를 동일하게 설정
  const targetNCounts: { [nurseId: number]: number } = {};
  availableANNurses.forEach((nurse, index) => {
    targetNCounts[nurse.id] = baseNDays;
  });
  
  console.log('목표 N근무 개수 (모두 동일):', targetNCounts);
  
  // 각 대상일에 딱 1명만 N근무 배정 (시프트 방식)
  let nurseIndex = 0;
  targetDays.forEach(day => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdayNames[dayOfWeek];
    
    console.log(`${day}일 (${weekday}): N근무 배정 시작`);
    
    // 이미 N근무가 배정된 AN이 있는지 확인
    let assignedCount = 0;
    for (const nurse of availableANNurses) {
      if (schedule[nurse.id][day] === 'N') {
        assignedCount++;
        console.log(`${nurse.name}: ${day}일 이미 N근무 배정됨`);
      }
    }
    
    // 이미 1명 이상 배정된 경우 스킵
    if (assignedCount > 0) {
      console.log(`${day}일: 이미 ${assignedCount}명의 AN이 N근무 배정됨 - 추가 배정 스킵`);
      return;
    }
    
    // N근무가 배정되지 않은 경우에만 1명 배정
    if (assignedCount === 0) {
      // 모든 AN이 동일한 N근무 개수를 가지도록 시프트 방식으로 선택
      let minNCount = Math.min(...Object.values(nurseNCounts));
      
      // N근무 개수가 가장 적은 AN들을 찾아서 그 중에서 선택
      const candidatesWithMinN = availableANNurses.filter(nurse => 
        nurseNCounts[nurse.id] === minNCount
      );
      
      // 시프트 방식으로 선택 (라운드로빈)
      const selectedNurse = candidatesWithMinN[nurseIndex % candidatesWithMinN.length];
      
      // 미리 입력된 스케줄이 없고, 목표 N근무 개수에 도달하지 않은 경우에만 배정
      const existingSchedule = schedule[selectedNurse.id][day];
      const hasNoSchedule = !existingSchedule || existingSchedule === '-';
      const needsMoreN = nurseNCounts[selectedNurse.id] < targetNCounts[selectedNurse.id];
      
      if (hasNoSchedule && needsMoreN) {
        // N 근무 배치 (딱 1명만)
        schedule[selectedNurse.id][day] = 'N';
        nurseNCounts[selectedNurse.id]++;
        console.log(`${selectedNurse.name}: ${day}일 N근무 배정 완료 (현재 N개수: ${nurseNCounts[selectedNurse.id]}/${targetNCounts[selectedNurse.id]}) - 딱 1명만 배정`);
        
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
        console.log(`${selectedNurse.name}: ${day}일 N근무 배정 불가 (미리입력: ${!hasNoSchedule}, 목표달성: ${!needsMoreN})`);
      }
      
      // 다음 AN으로 시프트
      nurseIndex++;
    }
  });
  
  console.log('최종 N근무 개수:', nurseNCounts);
}

// DDEO 패턴 생성 및 AN 스케줄 배정 (N근무는 이미 배정된 상태)
export function applyANDDEOPattern(
  anNurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  year: number,
  month: number
): void {
  console.log('=== AN DDEO 패턴 기반 스케줄 배정 ===');
  
  if (anNurses.length === 0) return;
  
  // N근무 가능한 AN들만 필터링
  const availableANNurses = anNurses.filter(nurse => nurse.workAvailability.N);
  if (availableANNurses.length === 0) {
    console.log('N 근무 가능한 AN 간호사가 없습니다.');
    return;
  }
  
  // DDEO 패턴 정의 (4일 주기)
  const DDEPattern = ['D', 'D', 'E', 'O'];
  console.log('DDEO 패턴:', DDEPattern);
  
  // 각 AN에 대해 DDEO 패턴을 시프트하여 적용
  availableANNurses.forEach((nurse, nurseIndex) => {
    console.log(`\n=== ${nurse.name} AN DDEO 패턴 적용 (시프트: ${nurseIndex}) ===`);
    
    // 시프트된 패턴 생성
    const shiftedPattern = [...DDEPattern];
    for (let i = 0; i < nurseIndex; i++) {
      shiftedPattern.push(shiftedPattern.shift()!); // 왼쪽으로 시프트
    }
    console.log(`${nurse.name} 시프트된 패턴:`, shiftedPattern);
    
    // 패턴을 월별 스케줄에 적용
    let patternIndex = 0;
    for (let dayIndex = 0; dayIndex < daysInMonth.length; dayIndex++) {
      const day = daysInMonth[dayIndex];
      
      // 이미 배정된 스케줄이 있으면 스킵
      if (schedule[nurse.id][day] !== '-' && schedule[nurse.id][day] !== undefined) {
        console.log(`${nurse.name} ${day}일: 이미 배정된 스케줄 (${schedule[nurse.id][day]}) - 스킵`);
        continue;
      }
      
      const workType = shiftedPattern[patternIndex % shiftedPattern.length];
      
      // 스케줄 배정
      schedule[nurse.id][day] = workType;
      console.log(`${nurse.name} ${day}일: ${workType} 배정`);
      
      patternIndex++;
    }
  });
  
  console.log('=== AN DDEO 패턴 배정 완료 ===');
}

// AN 스케줄 점수 계산
export function calculateANScheduleScore(
  nurse: Nurse,
  schedule: { [day: number]: string },
  daysInMonth: number[],
  constraints: ScheduleConstraints
): number {
  let score = 0;
  
  // 1. 근무일수 점수 (적절한 근무일수일수록 높은 점수)
  const workDays = daysInMonth.filter(day => {
    const workType = schedule[day];
    return workType && workType !== 'O' && workType !== '-';
  }).length;
  
  const totalDays = daysInMonth.length;
  const minWorkDays = totalDays - (constraints.minDaysOff + 2);
  const maxWorkDays = totalDays - constraints.minDaysOff;
  const idealWorkDays = Math.floor((minWorkDays + maxWorkDays) / 2);
  
  const workDayScore = Math.max(0, 100 - Math.abs(workDays - idealWorkDays) * 10);
  score += workDayScore;
  
  // 2. 연속 근무일 점수 (적절한 연속 근무일일수록 높은 점수)
  let maxConsecutiveWork = 0;
  let currentConsecutiveWork = 0;
  
  for (const day of daysInMonth) {
    const workType = schedule[day];
    if (workType && workType !== 'O' && workType !== '-') {
      currentConsecutiveWork++;
      maxConsecutiveWork = Math.max(maxConsecutiveWork, currentConsecutiveWork);
    } else {
      currentConsecutiveWork = 0;
    }
  }
  
  const consecutiveWorkScore = Math.max(0, 100 - Math.abs(maxConsecutiveWork - constraints.maxConsecutiveDays) * 20);
  score += consecutiveWorkScore;
  
  // 3. N근무 개수 점수 (적절한 N근무 개수일수록 높은 점수)
  const nWorkDays = daysInMonth.filter(day => schedule[day] === 'N').length;
  const idealNWorkDays = Math.floor(daysInMonth.length / 7); // 주당 1회 정도
  const nWorkScore = Math.max(0, 100 - Math.abs(nWorkDays - idealNWorkDays) * 15);
  score += nWorkScore;
  
  // 4. 휴무 분산 점수 (휴무가 고르게 분산될수록 높은 점수)
  const offDays = daysInMonth.filter(day => schedule[day] === 'O').length;
  const offDayScore = Math.max(0, 100 - Math.abs(offDays - constraints.minDaysOff) * 5);
  score += offDayScore;
  
  return Math.round(score);
}

// AN 스케줄 균등화 (점수 기반)
export function equalizeANSchedules(
  anNurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints
): void {
  console.log('=== AN 스케줄 점수 기반 균등화 ===');
  
  if (anNurses.length <= 1) return;
  
  // 각 AN의 현재 점수 계산
  const nurseScores: { [nurseId: number]: number } = {};
  anNurses.forEach(nurse => {
    nurseScores[nurse.id] = calculateANScheduleScore(nurse, schedule[nurse.id], daysInMonth, constraints);
  });
  
  console.log('현재 AN 점수:', nurseScores);
  
  // 점수 차이가 큰 경우 조정
  const scores = Object.values(nurseScores);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const scoreDiff = maxScore - minScore;
  
  console.log(`점수 차이: ${scoreDiff} (최고: ${maxScore}, 최저: ${minScore})`);
  
  if (scoreDiff > 50) { // 점수 차이가 50 이상이면 조정
    console.log('점수 차이가 큼 - 스케줄 조정 시작');
    
    // 점수가 낮은 AN의 스케줄을 개선
    const lowScoreNurses = anNurses.filter(nurse => nurseScores[nurse.id] < maxScore - 30);
    
    lowScoreNurses.forEach(nurse => {
      console.log(`${nurse.name} 스케줄 개선 시도 (현재 점수: ${nurseScores[nurse.id]})`);
      
      // 휴무일을 근무일로 변경하여 점수 개선
      const offDays = daysInMonth.filter(day => schedule[nurse.id][day] === 'O');
      const workDays = daysInMonth.filter(day => {
        const workType = schedule[nurse.id][day];
        return workType && workType !== 'O' && workType !== '-';
      });
      
      if (offDays.length > constraints.minDaysOff && workDays.length < (daysInMonth.length - constraints.minDaysOff)) {
        // 휴무일을 D근무로 변경
        const dayToChange = offDays[0];
        schedule[nurse.id][dayToChange] = 'D';
        console.log(`${nurse.name}: ${dayToChange}일 휴무를 D근무로 변경`);
        
        // 새로운 점수 계산
        const newScore = calculateANScheduleScore(nurse, schedule[nurse.id], daysInMonth, constraints);
        console.log(`${nurse.name} 새로운 점수: ${newScore}`);
      }
    });
  }
  
  console.log('=== AN 스케줄 균등화 완료 ===');
}

// AN 간호사 스케줄 생성 (N근무는 이미 배정된 상태에서 나머지 작성)
export function createANSchedule(
  nurse: Nurse,
  daysInMonth: number[],
  year: number,
  month: number,
  constraints: ScheduleConstraints,
  existingSchedule?: { [nurseId: number]: { [day: number]: string } }
): { [day: number]: string } {
  const nurseSchedule: { [day: number]: string } = {};

  // 1) 미리 입력된 스케줄 보호
  daysInMonth.forEach(day => {
    const existingWorkType = existingSchedule?.[nurse.id]?.[day];
    nurseSchedule[day] = existingWorkType && existingWorkType !== '-' ? existingWorkType : '-';
  });

  // 2) 월별 근무/휴무 한도 설정
  const minOffDays = constraints.minDaysOff;
  const totalDays = daysInMonth.length;
  const maxWorkDays = totalDays - minOffDays;
  const minWorkDays = totalDays - (minOffDays + 2);

  let workDays = 0;
  let offDays = 0;
  let consecutiveWorkDays = 0;
  let consecutiveOffDays = 0;

  // 3) 이미 배정된 스케줄 카운트
  for (const day of daysInMonth) {
    if (nurseSchedule[day] !== '-') {
      const wt = nurseSchedule[day];
      if (wt === 'O') {
        offDays++; consecutiveOffDays++; consecutiveWorkDays = 0;
      } else {
        workDays++; consecutiveWorkDays++; consecutiveOffDays = 0;
      }
    }
  }

  console.log(`${nurse.name}: 기존 스케줄 카운트 - workDays: ${workDays}, offDays: ${offDays}`);

  // 4) 나머지 스케줄 작성 (D, E, M 위주)
  for (const day of daysInMonth) {
    // 이미 배정된 스케줄이 있으면 스킵
    if (nurseSchedule[day] !== '-') {
      continue;
    }

    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHolidayDay = isHoliday(year, month, day);

    const canWork = workDays < maxWorkDays && 
                   consecutiveWorkDays < constraints.maxConsecutiveDays;
    const mustOff = consecutiveOffDays >= (constraints.maxConsecutiveOffDays || 3) ||
                   (workDays >= maxWorkDays) ||
                   consecutiveWorkDays >= constraints.maxConsecutiveDays;

    console.log(`${nurse.name} ${day}일: canWork=${canWork}, mustOff=${mustOff}, workDays=${workDays}/${maxWorkDays}, consecutiveWorkDays=${consecutiveWorkDays}, consecutiveOffDays=${consecutiveOffDays}`);

    if (mustOff || !canWork) {
      nurseSchedule[day] = 'O';
      offDays++; consecutiveOffDays++; consecutiveWorkDays = 0;
      console.log(`${nurse.name}: ${day}일 휴무 배치 (mustOff=${mustOff}, canWork=${canWork})`);
    } else {
      // 가능한 근무 추출 (AN은 D, E, M 위주)
      const availableWorkTypes = getAvailableWorkTypes(nurse, day, isWeekend, isHolidayDay);
      
      // AN은 일/월/목 이외에는 N근무 제외
      const dayOfWeek = date.getDay();
      const isNWorkDay = dayOfWeek === 0 || dayOfWeek === 1 || dayOfWeek === 4; // 일(0)/월(1)/목(4)
      const filteredWorkTypes = availableWorkTypes.filter(workType => {
        if (workType === 'N') {
          return isNWorkDay; // 일/월/목에만 N근무 허용
        }
        return true; // D, E, M은 모든 요일 허용
      });

      // RN과 동일한 제약 적용: E 다음 D 금지
      let filtered = applyWorkTypeConstraints(filteredWorkTypes, nurseSchedule, day, daysInMonth);

      if (filtered.length > 0) {
        const selected = selectWorkTypeByPreference(filtered, nurse);
        nurseSchedule[day] = selected;
        console.log(`${nurse.name}: ${day}일 ${selected} 근무 배정`);

        workDays++;
        consecutiveWorkDays++;
        consecutiveOffDays = 0;
      } else {
        nurseSchedule[day] = 'O';
        offDays++; consecutiveOffDays++; consecutiveWorkDays = 0;
      }
    }
  }

  // 5) 최소 근무 보장
  if (workDays < minWorkDays) {
    console.log(`${nurse.name}: 최소 근무일수 부족 (${workDays}/${minWorkDays}), 강제 근무 배치 시작`);
    
    const need = minWorkDays - workDays;
    let added = 0;
    for (let i = 0; i < daysInMonth.length && added < need; i++) {
      const d = daysInMonth[i];
      if (nurseSchedule[d] === '-' || nurseSchedule[d] === 'O') {
        const avail = getAvailableWorkTypes(nurse, d, false, false);
        
        // AN은 일/월/목 이외에는 N근무 제외
        const dDate = new Date(year, month - 1, d);
        const dDayOfWeek = dDate.getDay();
        const isDNWorkDay = dDayOfWeek === 0 || dDayOfWeek === 1 || dDayOfWeek === 4; // 일(0)/월(1)/목(4)
        const filteredAvail = avail.filter(workType => {
          if (workType === 'N') {
            return isDNWorkDay; // 일/월/목에만 N근무 허용
          }
          return true; // D, E, M은 모든 요일 허용
        });
        
        const filtered = applyWorkTypeConstraints(filteredAvail, nurseSchedule, d, daysInMonth);
        if (filtered.length > 0) {
          const sel = selectWorkTypeByPreference(filtered, nurse);
          nurseSchedule[d] = sel;
          added++; workDays++; if (nurseSchedule[d] === 'O') offDays--;
          console.log(`${nurse.name}: 최소 근무일수 보장을 위해 ${d}일 ${sel} 강제 배치`);
        }
      }
    }
  }

  console.log(`=== ${nurse.name} AN 스케줄 생성 완료 ===`);
  return nurseSchedule;
}
