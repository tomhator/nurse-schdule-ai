// 간호사 스케줄 최적화 메인 모듈

import { Nurse, ScheduleConstraints, ScheduleResult, StaffingRequirement } from './types';
import { getDaysInMonth } from './utils/date-utils';
import { sortNursesByPosition, getNursesByPriority } from './utils/nurse-utils';
import { saveCurrentScheduleToArray } from './utils/schedule-utils';

// 스케줄링 로직 임포트
import { createHNSchedule, enforceHNSchedule } from './schedulers/hn-scheduler';
import { 
  applyNightDedicatedAlternatingSchedule, 
  applySingleNightDedicatedSchedule,
  enforceNightDedicatedNNOOPattern,
  removeNightDedicatedDEWork
} from './schedulers/night-dedicated-scheduler';
import { createRNSchedule, applyRNScheduleConditions, applyRNAlternateOffPattern } from './schedulers/rn-scheduler';
import { applyANAlternateOffPattern, applyANWeeklyNSchedule, applyANDDEOPattern, equalizeANSchedules } from './schedulers/an-scheduler';

// 제약조건 로직 임포트
import {
  applyExistingScheduleConstraints,
  enforceConsecutiveWorkOffLimits,
  enforceNOOConstraint,
  enforceEDProhibition,
  applyMaxOffDaysLimit
} from './constraints/schedule-constraints';

// 검증 로직 임포트
import { validateFinalSchedule } from './validation/schedule-validator';
import { redistributeWorkToMonthEnd, zigzagDistribute, satisfyDailyTargetsByLocalSwap, enforceMinOffFairness, diversifySimilarSchedules } from './utils/rebalance';

// 근무 조건 조정 로직 임포트
import { adjustStaffingDeficits } from './utils/staffing-adjustment';

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

    // 1단계: 현재 근무표를 2차원 배열로 저장
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

    // 3단계: RN 교대 휴무 선배치 (저장된 O 보존 + 라운드로빈 O)
    console.log('=== RN 교대 휴무 선배치 시작 ===');
    applyRNAlternateOffPattern(sortedNurses, schedule, daysInMonth);
    console.log('=== RN 교대 휴무 선배치 완료 ===');

    // 3.5단계: AN N근무 시프트 배정 (일/월/목)
    console.log('=== AN N근무 시프트 배정 시작 ===');
    const anNurses = sortedNurses.filter(n => n.position === 'AN');
    if (anNurses.length > 0) {
      applyANWeeklyNSchedule(anNurses, schedule, daysInMonth, year, month);
    }
    console.log('=== AN N근무 시프트 배정 완료 ===');

    // 3.6단계: AN DDEO 패턴 기반 스케줄 배정
    console.log('=== AN DDEO 패턴 배정 시작 ===');
    if (anNurses.length > 0) {
      applyANDDEOPattern(anNurses, schedule, daysInMonth, year, month);
    }
    console.log('=== AN DDEO 패턴 배정 완료 ===');

    // 4단계: AN 교대 휴무 선배치 (저장된 O 보존 + 라운드로빈 O)
    console.log('=== AN 교대 휴무 선배치 시작 ===');
    applyANAlternateOffPattern(sortedNurses, schedule, daysInMonth);
    console.log('=== AN 교대 휴무 선배치 완료 ===');

    // 5단계: 우선순위에 따라 스케줄 작성 (미리 입력된 부분은 건드리지 않음)
    // 우선순위: HN > 야간근무자 > RN > AN
    const priorityGroups = getNursesByPriority(sortedNurses);
    
    priorityGroups.forEach((group) => {
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
      } else {
        // 일반 간호사들은 개별 스케줄 작성 (야간전담 간호사 제외)
        group.nurses.forEach((nurse) => {
          // 야간전담 간호사는 이미 위에서 처리했으므로 제외
          if (nurse.nightDedicated) {
            console.log(`${nurse.name}: 야간전담 간호사 - 개별 스케줄 생성 제외`);
            return;
          }
          
          console.log(`${nurse.name} (${nurse.position}) 스케줄 작성 시작`);
          
          // 간호사별 스케줄 작성 (미리 입력된 부분 보호)
          let nurseSchedule: { [day: number]: string };
          
          if (nurse.position === 'HN') {
            nurseSchedule = createHNSchedule(nurse, daysInMonth, year, month, schedule);
          } else if (nurse.position === 'RN') {
            // RN: 제약 조건을 지키면서 스케줄 작성
            nurseSchedule = createRNSchedule(nurse, daysInMonth, year, month, constraints, schedule);
          } else if (nurse.position === 'AN') {
            // AN: DDENOO 패턴으로 이미 배정됨 - 스킵
            console.log(`${nurse.name}: AN은 DDENOO 패턴으로 이미 배정됨 - 스킵`);
            return;
          } else {
            return;
          }
          
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

    // 5단계: RN 스케줄 조건 적용 (무조건 1명 근무 보장)
    console.log('=== RN 스케줄 조건 적용 시작 (무조건 1명 근무 보장) ===');
    applyRNScheduleConditions(sortedNurses, schedule, daysInMonth, year, month);
    console.log('=== RN 스케줄 조건 적용 완료 (무조건 1명 근무 보장) ===');

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

    // 14단계: RN 무조건 1명 근무 최종 검증 및 강제 적용
    console.log('=== RN 무조건 1명 근무 최종 검증 시작 ===');
    applyRNScheduleConditions(sortedNurses, schedule, daysInMonth, year, month);
    console.log('=== RN 무조건 1명 근무 최종 검증 완료 ===');

    // 15단계: 근무 조건 설정 vs 실제 근무표 비교 및 조정
    console.log('=== 근무 조건 설정 vs 실제 근무표 비교 및 조정 시작 ===');
    const adjustedSchedule = adjustStaffingDeficits(sortedNurses, schedule, daysInMonth, staffingRequirements, constraints, year, month);
    Object.assign(schedule, adjustedSchedule);
    console.log('=== 근무 조건 설정 vs 실제 근무표 비교 및 조정 완료 ===');

    // 16단계: 지그재그 분산으로 월초 쏠림 예방
    console.log('=== 지그재그 분산 시작 ===');
    zigzagDistribute(sortedNurses, schedule, daysInMonth, constraints, initialSchedule);
    console.log('=== 지그재그 분산 완료 ===');

    // 17단계: 월 초 과밀 근무를 월 말로 분산
    console.log('=== 월 초 과밀 근무 월말 분산 시작 ===');
    redistributeWorkToMonthEnd(sortedNurses, schedule, daysInMonth, constraints, initialSchedule);
    console.log('=== 월 초 과밀 근무 월말 분산 완료 ===');

    // 18단계: 일일 목표(A) 만족을 위한 로컬 스왑 수행 (N 제외)
    console.log('=== 일일 목표(A) 만족 로컬 스왑 시작 ===');
    const req = staffingRequirements;
    const requiredByWork = {
      D: (req['HN']?.['D'] || 0) + (req['RN']?.['D'] || 0) + (req['AN']?.['D'] || 0),
      E: (req['HN']?.['E'] || 0) + (req['RN']?.['E'] || 0) + (req['AN']?.['E'] || 0),
      N: (req['HN']?.['N'] || 0) + (req['RN']?.['N'] || 0) + (req['AN']?.['N'] || 0),
      M: (req['HN']?.['M'] || 0) + (req['RN']?.['M'] || 0) + (req['AN']?.['M'] || 0)
    } as { D: number; E: number; N: number; M: number };
    satisfyDailyTargetsByLocalSwap(sortedNurses, schedule, daysInMonth, constraints, requiredByWork);
    console.log('=== 일일 목표(A) 만족 로컬 스왑 완료 ===');

    // 19단계: 최소 휴무일 공정 분배 및 유사 스케줄 분산
    console.log('=== 최소 휴무일 공정 분배 시작 ===');
    enforceMinOffFairness(sortedNurses, schedule, daysInMonth, constraints, requiredByWork);
    console.log('=== 최소 휴무일 공정 분배 완료 ===');

    console.log('=== 유사 스케줄 분산 시작 ===');
    diversifySimilarSchedules(sortedNurses, schedule, daysInMonth, constraints);
    console.log('=== 유사 스케줄 분산 완료 ===');

    // 20단계: AN 스케줄 점수 기반 균등화
    console.log('=== AN 스케줄 균등화 시작 ===');
    if (anNurses.length > 0) {
      equalizeANSchedules(anNurses, schedule, daysInMonth, constraints);
    }
    console.log('=== AN 스케줄 균등화 완료 ===');

    // 21단계: 조정 이후 제약조건 재적용 (연속근무/휴무, N-OO, E-D 금지, HN, 야간전담, RN 최소 1명)
    console.log('=== 조정 이후 제약조건 재적용 시작 ===');
    enforceNOOConstraint(sortedNurses, schedule, daysInMonth);
    enforceEDProhibition(sortedNurses, schedule, daysInMonth);
    enforceConsecutiveWorkOffLimits(sortedNurses, schedule, daysInMonth, constraints);
    enforceHNSchedule(sortedNurses, schedule, daysInMonth, year, month);
    enforceNightDedicatedNNOOPattern(sortedNurses, schedule, daysInMonth);
    applyRNScheduleConditions(sortedNurses, schedule, daysInMonth, year, month);
    console.log('=== 조정 이후 제약조건 재적용 완료 ===');

    // 21단계: 최종 스케줄 종합 검증
    console.log('=== 최종 스케줄 종합 검증 시작 ===');
    const validationResult = validateFinalSchedule(sortedNurses, schedule, daysInMonth, constraints, year, month);
    console.log('=== 최종 스케줄 종합 검증 완료 ===');

    // 검증 결과를 violations에 추가
    violations.push(...validationResult.violations);

    return {
      success: violations.length === 0,
      schedule,
      message: violations.length === 0 ? '스케줄이 성공적으로 생성되었습니다.' : '일부 제약 조건을 위반했습니다.',
      violations
    };
  } catch {
    return {
      success: false,
      schedule: {},
      message: '스케줄 생성 중 오류가 발생했습니다.',
      violations: [error instanceof Error ? error.message : '알 수 없는 오류']
    };
  }
}

