import { Nurse, StaffingRequirement, ScheduleConstraints } from '../types';

// 근무 조건 설정과 실제 근무표 비교하여 부족한 경우 조정
export function adjustStaffingDeficits(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  staffingRequirements: StaffingRequirement,
  constraints: ScheduleConstraints,
  year: number,
  month: number
): { [nurseId: number]: { [day: number]: string } } {
  console.log('=== 근무 조건 설정 vs 실제 근무표 비교 및 조정 시작 ===');
  
  const adjustedSchedule = JSON.parse(JSON.stringify(schedule)); // 깊은 복사
  
  // 각 날짜별로 근무 유형별 부족 인원 계산 및 조정
  daysInMonth.forEach(day => {
    console.log(`\n--- ${day}일 근무 조정 시작 ---`);
    
    // 현재 근무표에서 각 근무 유형별 근무자 수 계산
    const currentWorkers = {
      D: 0,
      E: 0,
      N: 0,
      M: 0
    };
    
    nurses.forEach(nurse => {
      const workType = adjustedSchedule[nurse.id]?.[day];
      if (workType && workType !== 'O' && workType !== '-') {
        if (currentWorkers[workType as keyof typeof currentWorkers] !== undefined) {
          currentWorkers[workType as keyof typeof currentWorkers]++;
        }
      }
    });
    
    console.log(`${day}일 현재 근무자 수:`, currentWorkers);
    
    // 근무 조건 설정에서 필요한 인원 수 계산
    const requiredWorkers = {
      D: (staffingRequirements.HN_D || 0) + (staffingRequirements.RN_D || 0) + (staffingRequirements.AN_D || 0),
      E: (staffingRequirements.HN_E || 0) + (staffingRequirements.RN_E || 0) + (staffingRequirements.AN_E || 0),
      N: (staffingRequirements.HN_N || 0) + (staffingRequirements.RN_N || 0) + (staffingRequirements.AN_N || 0),
      M: (staffingRequirements.HN_M || 0) + (staffingRequirements.RN_M || 0) + (staffingRequirements.AN_M || 0)
    };
    
    console.log(`${day}일 필요 인원 수:`, requiredWorkers);
    
    // 부족한 근무 유형별로 조정
    Object.keys(requiredWorkers).forEach(workType => {
      const current = currentWorkers[workType as keyof typeof currentWorkers];
      const required = requiredWorkers[workType as keyof typeof requiredWorkers];
      
      if (current < required) {
        const deficit = required - current;
        console.log(`${day}일 ${workType} 근무 부족: ${deficit}명`);
        
        // 부족한 인원만큼 해당 근무 유형으로 조정
        let adjustedCount = 0;
        
        // 1. 먼저 빈 스케줄('-')을 해당 근무 유형으로 변경 (점수 기반 후보 선정)
        while (adjustedCount < deficit) {
          const candidates = nurses.filter(nurse => {
            const currentWork = adjustedSchedule[nurse.id]?.[day];
            return currentWork === '-' && canAssignWithConstraints(nurse, day, workType, adjustedSchedule, constraints);
          });
          if (candidates.length === 0) break;
          const best = selectBestCandidate(candidates, adjustedSchedule, day, workType);
          adjustedSchedule[best.id][day] = workType;
          console.log(`${best.name}: ${day}일 ${workType} 근무로 조정 (빈 스케줄, 균형 우선)`);
          adjustedCount++;
        }
        
        // 2. 빈 스케줄이 부족하면 O 근무를 해당 근무 유형으로 변경
        if (adjustedCount < deficit) {
          while (adjustedCount < deficit) {
            const candidates = nurses.filter(nurse => {
              const currentWork = adjustedSchedule[nurse.id]?.[day];
              return currentWork === 'O' && canAssignWithConstraints(nurse, day, workType, adjustedSchedule, constraints);
            });
            if (candidates.length === 0) break;
            const best = selectBestCandidate(candidates, adjustedSchedule, day, workType);
            adjustedSchedule[best.id][day] = workType;
            console.log(`${best.name}: ${day}일 ${workType} 근무로 조정 (O → ${workType}, 균형 우선)`);
            adjustedCount++;
          }
        }
        
        // 3. 여전히 부족하면 다른 근무 유형을 해당 근무 유형으로 변경
        if (adjustedCount < deficit) {
          while (adjustedCount < deficit) {
            const candidates = nurses.filter(nurse => {
              const currentWork = adjustedSchedule[nurse.id]?.[day];
              return currentWork && currentWork !== workType && currentWork !== 'O' && currentWork !== '-' &&
                canAssignWithConstraints(nurse, day, workType, adjustedSchedule, constraints);
            });
            if (candidates.length === 0) break;
            const best = selectBestCandidate(candidates, adjustedSchedule, day, workType);
            const prevWork = adjustedSchedule[best.id][day];
            adjustedSchedule[best.id][day] = workType;
            console.log(`${best.name}: ${day}일 ${workType} 근무로 조정 (${prevWork} → ${workType}, 균형 우선)`);
            adjustedCount++;
          }
        }
        
        console.log(`${day}일 ${workType} 근무 조정 완료: ${adjustedCount}명 추가`);
      }
    });
  });
  
  console.log('=== 근무 조건 설정 vs 실제 근무표 비교 및 조정 완료 ===');
  return adjustedSchedule;
}

// 조정 시 제약을 만족하는지 검증
function canAssignWithConstraints(
  nurse: Nurse,
  day: number,
  workType: string,
  schedule: { [nurseId: number]: { [day: number]: string } },
  constraints: ScheduleConstraints
): boolean {
  // 고정/제외 대상
  if (nurse.position === 'HN') return false; // HN은 조정하지 않음
  if (nurse.position === 'AN') return false; // AN은 조정/배정 제외
  if (nurse.nightDedicated) return false; // 야간전담 조정 금지 (NNOO 유지)

  // N은 조정 단계에서 배정하지 않음 (N-OO 복잡도 회피)
  if (workType === 'N') return false;

  // M 근무는 AN만 가능
  if (workType === 'M' && nurse.position !== 'AN') return false;

  // 근무가능 체크 (불리언 맵)
  if (nurse.workAvailability && typeof nurse.workAvailability === 'object') {
    if (!nurse.workAvailability[workType as keyof typeof nurse.workAvailability]) return false;
  }

  // E-D 금지: 전일 E이면 금일 D 금지
  const prevDay = day - 1;
  if (prevDay >= 1) {
    const prev = schedule[nurse.id]?.[prevDay];
    if (prev === 'E' && workType === 'D') return false;
  }

  // N-OO 유지: 전일/전전일이 N이면 금일은 O이어야 함
  const prev1 = day - 1;
  const prev2 = day - 2;
  if ((prev1 >= 1 && schedule[nurse.id]?.[prev1] === 'N') || (prev2 >= 1 && schedule[nurse.id]?.[prev2] === 'N')) {
    // 조정 단계에서는 O를 만들지 않으므로, 이 경우 배정 금지
    return false;
  }

  // 연속 근무/휴무 한도 체크 (근무 배정 시 근무 연속 한도만 확인)
  const maxConsecutiveWork = constraints.maxConsecutiveDays;
  // 현재 연속 근무일 계산 (배정 가정)
  let consecutiveWork = 0;
  // 뒤로
  for (let d = day - 1; d >= 1; d--) {
    const w = schedule[nurse.id]?.[d];
    if (w && w !== 'O' && w !== '-') consecutiveWork++; else break;
  }
  // 금일 배정 포함
  consecutiveWork++;
  if (consecutiveWork > maxConsecutiveWork) return false;

  return true;
}

// 후보 우선순위 점수: 낮을수록 우선
function selectBestCandidate(
  candidates: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  day: number,
  workType: string
): Nurse {
  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const n of candidates) {
    const totalWorked = Object.values(schedule[n.id] || {}).filter(w => w && w !== 'O' && w !== '-').length;
    const consecBack = countConsecBack(schedule, n.id, day - 1);
    const samePrev = schedule[n.id]?.[day - 1] === workType ? 1 : 0;

    // 가중치: 총 근무 적을수록(우선), 연속근무 짧을수록(우선), 동일근무 연속 회피
    const score = totalWorked * 3 + consecBack * 2 + samePrev * 1;
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

function countConsecBack(
  schedule: { [nurseId: number]: { [day: number]: string } },
  nurseId: number,
  startDay: number
): number {
  let cnt = 0;
  for (let d = startDay; d >= 1; d--) {
    const w = schedule[nurseId]?.[d];
    if (w && w !== 'O' && w !== '-') cnt++; else break;
  }
  return cnt;
}
