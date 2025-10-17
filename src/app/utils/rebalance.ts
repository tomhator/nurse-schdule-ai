import { Nurse, ScheduleConstraints } from '../types';

// 월 초에 몰린 근무를 월 말의 O로 분산 (기존 입력 스케줄은 보존)
export function redistributeWorkToMonthEnd(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints,
  initialSchedule?: { [nurseId: number]: { [day: number]: string } }
): void {
  const isPrefilled = (nurseId: number, day: number) => {
    if (!initialSchedule) return false;
    const init = initialSchedule[nurseId]?.[day];
    return !!init && init !== '-';
  };

  nurses.forEach(nurse => {
    if (nurse.position === 'HN') return; // HN 제외 (고정 규칙 유지)
    if (nurse.position === 'AN') return; // AN 제외
    if (nurse.nightDedicated) return; // 야간전담 제외 (NNOO 유지)

    const maxConsecutive = constraints.maxConsecutiveDays;
    const totalDays = daysInMonth.length;

    // 앞쪽(월 초) 근무 과밀 블럭을 찾아 뒤쪽(월 말) O와 교환
    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      const day = daysInMonth[dayIdx];
      const current = schedule[nurse.id]?.[day];
      if (!current || current === 'O' || current === '-') continue;
      if (isPrefilled(nurse.id, day)) continue; // 기존 입력 보존

      // 연속 근무 압력 체크: 현재 날짜 주변 연속 근무 길이
      const before = countConsecutiveBackward(schedule, nurse.id, day - 1);
      const after = countConsecutiveForward(schedule, nurse.id, day + 1, totalDays);
      const blockLen = before + 1 + after;
      if (blockLen <= maxConsecutive) continue; // 과밀 블럭이 아닐 때 skip

      // 뒤에서 앞으로 O를 탐색하여 스왑 시도
      for (let targetIdx = totalDays - 1; targetIdx > dayIdx; targetIdx--) {
        const tDay = daysInMonth[targetIdx];
        const tCur = schedule[nurse.id]?.[tDay] || '-';
        if (isPrefilled(nurse.id, tDay)) continue; // 기존 입력 보존
        if (tCur !== 'O' && tCur !== '-') continue; // 월말은 O(또는 빈칸)이어야 함
        if (!canAssignAtDay(nurse, tDay, current, schedule, constraints)) continue; // 타겟 배정 가능성 검증
        if (!safeToRemoveFromDay(nurse, day, schedule)) continue; // 소스 제거로 제약 깨지지 않는지

        // 스왑 실행: 월초 근무 -> O, 월말 O -> 근무
        schedule[nurse.id][day] = tCur === '-' ? 'O' : 'O';
        schedule[nurse.id][tDay] = current;
        break; // 한 번 이동 후 다음 소스 날짜로
      }
    }
  });
}

// 지그재그 분산: 앞→뒤→앞 순으로 비어있는 날(O/-)에 근무를 고르게 퍼뜨림
export function zigzagDistribute(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints,
  initialSchedule?: { [nurseId: number]: { [day: number]: string } }
): void {
  const forward = [...daysInMonth];
  const backward = [...daysInMonth].reverse();
  const order = [] as number[];
  for (let i = 0; i < forward.length; i++) {
    order.push(forward[i]);
    if (i < backward.length) order.push(backward[i]);
  }

  const isPrefilled = (nurseId: number, day: number) => {
    if (!initialSchedule) return false;
    const init = initialSchedule[nurseId]?.[day];
    return !!init && init !== '-';
  };

  nurses.forEach(nurse => {
    if (nurse.position === 'HN') return;
    if (nurse.position === 'AN') return; // AN 제외
    if (nurse.nightDedicated) return;

    order.forEach(day => {
      const cur = schedule[nurse.id]?.[day] || '-';
      if (cur !== 'O' && cur !== '-') return;
      if (isPrefilled(nurse.id, day)) return;

      // 주변에 과도한 연속 근무 블럭이 앞쪽에 있으면, 가능한 근무를 하나 배치
      const leftBlock = countConsecutiveBackward(schedule, nurse.id, day - 1);
      if (leftBlock >= constraints.maxConsecutiveDays) return; // 이미 앞이 꽉참

      // 가능한 근무 후보 (N은 제외, M은 AN만)
  // 근무가능이 불리언 맵이므로 그에 맞춰 후보 추출
  const candidates = ['D','E','M'].filter(w =>
    (w !== 'M' || nurse.position === 'AN') &&
    (nurse.workAvailability?.[w as 'D'|'E'|'N'|'M'] ?? true)
  );
      for (const w of candidates) {
        if (canAssignAtDay(nurse, day, w, schedule, constraints)) {
          schedule[nurse.id][day] = w;
          break;
        }
      }
    });
  });
}

// 일일 목표(A) 만족을 위한 로컬 스왑: 같은 날에서 O와 근무를 교환하여 부족 B<A 해소
export function satisfyDailyTargetsByLocalSwap(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints,
  requiredByWork: { D: number; E: number; N: number; M: number }
): void {
  const countDay = (day: number) => {
    const c = { D: 0, E: 0, N: 0, M: 0 } as { [k: string]: number };
    nurses.forEach(n => {
      const w = schedule[n.id]?.[day];
      if (w && c[w] !== undefined) c[w] += 1;
    });
    return c as { D: number; E: number; N: number; M: number };
  };

  daysInMonth.forEach(day => {
    const cur = countDay(day);
    (['D','E','N','M'] as const).forEach(wt => {
      const need = (requiredByWork as {[key: string]: number})[wt] || 0;
      while (cur[wt] < need) {
        // O를 가진 간호사를 찾아 wt로 변경 시도
        let changed = false;
        for (const nurse of nurses) {
          const w = schedule[nurse.id]?.[day] || '-';
          if (w !== 'O' && w !== '-') continue;
          // N은 여기서도 제외 (N-OO 영향), M은 AN만
          if (wt === 'N') continue;
          if (wt === 'M' && nurse.position !== 'AN') continue;
          if (!canAssignAtDay(nurse, day, wt, schedule, constraints)) continue;
          schedule[nurse.id][day] = wt;
          cur[wt] += 1;
          changed = true;
          break;
        }
        if (!changed) break; // 더 이상 채울 수 없으면 중지
      }
    });
  });
}

// 각 간호사의 최소 휴무일(minDaysOff)을 충족하도록 공정하게 O를 채움
export function enforceMinOffFairness(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints,
  requiredByWork?: { D: number; E: number; N: number; M: number }
): void {
  const minOff = constraints.minDaysOff;
  const maxOffStreak = constraints.maxConsecutiveOffDays || 3;

  const countOff = (nurseId: number) => daysInMonth.filter(d => schedule[nurseId]?.[d] === 'O').length;
  const offStreakIfSet = (nurseId: number, day: number) => {
    let streak = 1; // day를 O로 가정
    for (let d = day - 1; d >= 1; d--) {
      const w = schedule[nurseId]?.[d];
      if (w === 'O') streak++; else break;
    }
    for (let d = day + 1; d <= daysInMonth.length; d++) {
      const w = schedule[nurseId]?.[d];
      if (w === 'O') streak++; else break;
    }
    return streak;
  };

  const countDayByType = (day: number) => {
    const c: { D: number; E: number; N: number; M: number } = { D: 0, E: 0, N: 0, M: 0 };
    nurses.forEach(n => {
      const w = schedule[n.id]?.[day];
      if (w && c[w as keyof typeof c] !== undefined) c[w as keyof typeof c] += 1;
    });
    return c;
  };

  nurses.forEach(nurse => {
    if (nurse.position === 'HN') return; // HN 제외
    if (nurse.nightDedicated) return; // 야간전담 제외

    let currentOff = countOff(nurse.id);
    while (currentOff < minOff) {
      // 후보: '-' 우선, 그 다음 D/E를 O로 바꾸기 (N, M 제외)
      let changed = false;
      for (const day of daysInMonth) {
        const cur = schedule[nurse.id]?.[day] || '-';
        if (cur === 'N' || cur === 'M') continue;
        if (schedule[nurse.id]?.[day - 1] === 'N' || schedule[nurse.id]?.[day - 2] === 'N') continue; // N-OO 보호
        // 설정 시 연속 O 한도 확인
        if (offStreakIfSet(nurse.id, day) > maxOffStreak) continue;
        // 일일 필요 인원(A) 고려: 해당 근무 유형의 현재 인원이 A보다 큰 날 위주로 O 전환
        if (requiredByWork) {
          const daily = countDayByType(day);
          const req = requiredByWork[cur as 'D'|'E'|'N'|'M'] || 0;
          if (cur !== '-' && daily[cur as 'D'|'E'|'N'|'M'] <= req) continue;
        }
        // 전일 E이면 금일 D→O는 OK, 제약 없음
        // 근무가능은 O에는 영향 없음
        schedule[nurse.id][day] = 'O';
        currentOff++;
        changed = true;
        break;
      }
      if (!changed) break; // 더 이상 늘릴 수 없으면 중지
    }
  });
}

// 너무 유사한 스케줄을 가진 간호사 쌍을 분산 (예: 연속 D를 E로 일부 치환 등)
export function diversifySimilarSchedules(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints
): void {
  // HN/야간전담 제외 대상 목록
  const active = nurses.filter(n => n.position !== 'HN' && !n.nightDedicated);

  const similarity = (aId: number, bId: number) => {
    let same = 0;
    daysInMonth.forEach(d => {
      if (schedule[aId]?.[d] === schedule[bId]?.[d]) same++;
    });
    return same / daysInMonth.length;
  };

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const sim = similarity(a.id, b.id);
      if (sim < 0.8) continue; // 80% 이상 동일 시 분산 시도

      // 교대 가능한 날 선택: 여러 날에서 최대 3회까지 분산 시도
      let changes = 0;
      for (const d of daysInMonth) {
        const aw = schedule[a.id]?.[d] || '-';
        const bw = schedule[b.id]?.[d] || '-';
        if (aw === bw && (aw === 'D' || aw === 'E')) {
          // a를 유지, b를 전환 시도
          const target = aw === 'D' ? 'E' : 'D';
          // 근무가능 및 제약 검사
          if (
            (b.workAvailability?.[target as 'D'|'E'|'N'|'M'] ?? true) &&
            canAssignAtDay(b, d, target, schedule, constraints)
          ) {
            schedule[b.id][d] = target;
            changes++;
            if (changes >= 3) break;
          }
        }
      }

      // 강제 분산 fallback: 동일도가 100%에 가까우면(≥0.99) 격일로 전환 시도
      if (changes === 0 && sim >= 0.99) {
        let toggles = 0;
        for (let idx = 0; idx < daysInMonth.length; idx += 2) {
          const d = daysInMonth[idx];
          const bw = schedule[b.id]?.[d] || '-';
          if (bw === 'D' || bw === 'E') {
            const target = bw === 'D' ? 'E' : 'D';
            if ((b.workAvailability?.[target as 'D'|'E'|'N'|'M'] ?? true) &&
                canAssignAtDay(b, d, target, schedule, constraints)) {
              schedule[b.id][d] = target;
              toggles++;
              if (toggles >= 3) break; // 최대 3회 분산
            }
          }
        }
      }
    }
  }
}

// 겹치는 휴무(O)가 많을 때 분산: 같은 날에 둘 다 O이면 한 명의 O를 다른 날로 이동
export function spreadOffOverlap(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints,
  requiredByWork?: { D: number; E: number; N: number; M: number }
): void {
  const active = nurses.filter(n => n.position !== 'HN' && !n.nightDedicated);

  const countDayByType = (day: number) => {
    const c: { D: number; E: number; N: number; M: number } = { D: 0, E: 0, N: 0, M: 0 };
    nurses.forEach(n => {
      const w = schedule[n.id]?.[day];
      if (w && c[w as keyof typeof c] !== undefined) c[w as keyof typeof c] += 1;
    });
    return c;
  };

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      for (const d of daysInMonth) {
        const aw = schedule[a.id]?.[d] || '-';
        const bw = schedule[b.id]?.[d] || '-';
        if (aw === 'O' && bw === 'O') {
          // a 또는 b 중 한 명의 O를 다른 날로 이동
          const daily = countDayByType(d);
          const reqD = requiredByWork?.D ?? 0;
          const reqE = requiredByWork?.E ?? 0;
          // 같은 날에 D/E 인원이 요구치보다 적으면 O를 유지
          if (daily.D < reqD || daily.E < reqE) continue;

          // b의 O를 이동할 후보 날 탐색
          const mover = b;
          let moved = false;
          for (const td of daysInMonth) {
            if (td === d) continue;
            const tw = schedule[mover.id]?.[td] || '-';
            if (tw === 'O') continue; // 이미 O인 날은 스킵
            if (tw === 'N' || tw === 'M') continue; // N/M은 O로 바꾸지 않음
            // td에서 O로 바꿀 경우 연속 O 한도 및 N-OO 보호
            if (wouldExceedOffStreak(schedule, mover.id, td, constraints)) continue;
            if (schedule[mover.id]?.[td - 1] === 'N' || schedule[mover.id]?.[td - 2] === 'N') continue;

            // d에서 mover의 O를 해제하고, td에 O를 설정
            // d에서 해제가 일일 요구치(A)를 떨어뜨리지 않도록 확인
            // const afterDaily = { ...daily }; // 사용하지 않는 변수
            // d에서 O→근무 전환은 하지 않고, 단순히 겹침 해소만: d는 a의 O만 유지
            // mover의 d는 O 해제 필요 없음(둘 다 O 유지해도 요구치 만족하면 넘어감)
            // 실제 이동은 td에 O를 추가하는 방식으로 처리

            // td의 일일 요구치 고려: td의 근무 인원이 요구치에 모자라면 O로 바꾸지 않음
            const tdCount = countDayByType(td);
            const curType = schedule[mover.id]?.[td];
            if (curType && (curType === 'D' || curType === 'E')) {
              const need = (requiredByWork as {[key: string]: number})?.[curType] ?? 0;
              if (tdCount[curType] <= need) continue;
            }

            schedule[mover.id][td] = 'O';
            moved = true;
            break;
          }
          if (moved) break; // 하루 분산 성공 시 다음 날로
        }
      }
    }
  }
}

// 최대 허용 휴무(min+2)까지 추가로 O를 배치하여 잔여 휴무를 소진
function wouldExceedOffStreak(
  schedule: { [nurseId: number]: { [day: number]: string } },
  nurseId: number,
  day: number,
  constraints: ScheduleConstraints
): boolean {
  const maxOffStreak = constraints.maxConsecutiveOffDays || 3;
  let streak = 1;
  for (let d = day - 1; d >= 1; d--) {
    const w = schedule[nurseId]?.[d];
    if (w === 'O') streak++; else break;
  }
  for (let d = day + 1; d <= Object.keys(schedule[nurseId] || {}).length; d++) {
    const w = schedule[nurseId]?.[d];
    if (w === 'O') streak++; else break;
  }
  return streak > maxOffStreak;
}

function countConsecutiveBackward(
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

function countConsecutiveForward(
  schedule: { [nurseId: number]: { [day: number]: string } },
  nurseId: number,
  startDay: number,
  totalDays: number
): number {
  let cnt = 0;
  for (let d = startDay; d <= totalDays; d++) {
    const w = schedule[nurseId]?.[d];
    if (w && w !== 'O' && w !== '-') cnt++; else break;
  }
  return cnt;
}

// 타겟 날짜에 workType 배정 가능 여부 (주요 제약 검증)
function canAssignAtDay(
  nurse: Nurse,
  day: number,
  workType: string,
  schedule: { [nurseId: number]: { [day: number]: string } },
  constraints: ScheduleConstraints
): boolean {
  // 근무가능 (불리언 맵)
  if (nurse.workAvailability && typeof nurse.workAvailability === 'object') {
    if (!nurse.workAvailability[workType as 'D'|'E'|'N'|'M']) return false;
  }
  // M은 AN만 가능
  if (workType === 'M' && nurse.position !== 'AN') return false;
  // E-D 금지
  const prev = schedule[nurse.id]?.[day - 1];
  if (prev === 'E' && workType === 'D') return false;
  // N-OO 진행 중 보호: 직전/직전직전이 N이면 금일 O여야 하므로 근무 배정 금지
  if (schedule[nurse.id]?.[day - 1] === 'N' || schedule[nurse.id]?.[day - 2] === 'N') return false;
  // 연속근무 한도
  let consec = 1; // 금일 근무 포함 가정
  // 뒤로
  for (let d = day - 1; d >= 1; d--) {
    const w = schedule[nurse.id]?.[d];
    if (w && w !== 'O' && w !== '-') consec++; else break;
  }
  // 앞으로
  const totalDays = Object.keys(schedule[nurse.id] || {}).length;
  for (let d = day + 1; d <= totalDays; d++) {
    const w = schedule[nurse.id]?.[d];
    if (w && w !== 'O' && w !== '-') consec++; else break;
  }
  if (consec > constraints.maxConsecutiveDays) return false;
  return true;
}

// 소스 날짜에서 근무 제거가 안전한지 (N-OO, E-D 보호)
function safeToRemoveFromDay(
  nurse: Nurse,
  day: number,
  schedule: { [nurseId: number]: { [day: number]: string } }
): boolean {
  // const prev = schedule[nurse.id]?.[day - 1]; // 사용하지 않는 변수
  const cur = schedule[nurse.id]?.[day];
  // const next = schedule[nurse.id]?.[day + 1]; // 사용하지 않는 변수
  // 현재 근무를 O로 바꾸는 것은 N-OO에는 유리하고, E-D 금지에도 영향 없음
  // 단, RN 일일 최소 1명 등 전역 제약은 최종 단계에서 재강제하므로 여기서는 허용
  // 야간전담/HN은 상위에서 이미 배제
  if (!cur || cur === 'O' || cur === '-') return false;
  // N은 여기서 제거하지 않음 (N-OO 흐트러짐 방지)
  if (cur === 'N') return false;
  return true;
}


