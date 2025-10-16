// 스케줄 제약조건 관련 로직

import { Nurse, ScheduleConstraints } from '../types';
import { getAvailableWorkTypes } from '../utils/nurse-utils';
import { selectWorkTypeByPreference } from '../utils/work-selection';
import { applyWorkTypeConstraints } from '../utils/schedule-utils';

// 기존 스케줄에 제약조건 적용
export function applyExistingScheduleConstraints(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints?: ScheduleConstraints
): void {
  nurses.forEach(nurse => {
    console.log(`=== ${nurse.name} 기존 스케줄 제약조건 적용 ===`);
    
    // 야간전담 간호사는 제외 (N과 O만 가능, 휴무일 제한 무시)
    if (nurse.nightDedicated) {
      console.log(`${nurse.name}: 야간전담 간호사 - 기존 스케줄 제약조건 적용 제외 (휴무일 제한 무시)`);
      return;
    }
    // AN 제외
    if (nurse.position === 'AN') {
      console.log(`${nurse.name}: AN - 기존 스케줄 제약조건 적용 제외`);
      return;
    }
    
    // 1. N 다음에는 O 2개 제약조건 적용 (더 엄격하게)
    for (let i = 0; i < daysInMonth.length - 2; i++) {
      const day = daysInMonth[i];
      const workType = schedule[nurse.id][day];
      
      if (workType === 'N') {
        const nextDay1 = day + 1;
        const nextDay2 = day + 2;
        
        // 다음 2일이 월 범위 내에 있는지 확인
        if (nextDay1 <= daysInMonth.length && nextDay2 <= daysInMonth.length) {
          // 다음 2일이 O가 아닌 경우 강제로 O로 변경 (빈 상태든 다른 근무든 상관없이)
          if (schedule[nurse.id][nextDay1] !== 'O') {
            schedule[nurse.id][nextDay1] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay1}일 강제 O 설정 (기존: ${schedule[nurse.id][nextDay1]})`);
          }
          if (schedule[nurse.id][nextDay2] !== 'O') {
            schedule[nurse.id][nextDay2] = 'O';
            console.log(`${nurse.name}: N 근무 후 ${nextDay2}일 강제 O 설정 (기존: ${schedule[nurse.id][nextDay2]})`);
          }
        }
      }
    }
    
    // 2. E 다음에는 D 금지 제약조건 검증 및 수정
    for (let i = 1; i < daysInMonth.length; i++) {
      const prevDay = daysInMonth[i - 1];
      const currentDay = daysInMonth[i];
      const prevWorkType = schedule[nurse.id][prevDay];
      const currentWorkType = schedule[nurse.id][currentDay];
      
      if (prevWorkType === 'E' && currentWorkType === 'D') {
        // E 다음 D인 경우 D를 다른 근무 유형으로 변경
        const alternativeWorkTypes = ['E', 'N', 'M', 'O'];
        const selectedAlternative = alternativeWorkTypes[Math.floor(Math.random() * alternativeWorkTypes.length)];
        schedule[nurse.id][currentDay] = selectedAlternative;
        console.log(`${nurse.name}: E-D 제약 위반으로 ${currentDay}일 D를 ${selectedAlternative}로 변경`);
      }
    }
    
    // 3. 최대 연속 휴무일 초과 시 강제 근무 배치
    if (constraints) {
      const maxConsecutiveOffDays = constraints.maxConsecutiveOffDays || 3;
      let consecutiveOffDays = 0;
      let startOffDay = -1;
      
      for (let i = 0; i < daysInMonth.length; i++) {
        const day = daysInMonth[i];
        const workType = schedule[nurse.id][day];
        
        if (workType === 'O') {
          if (consecutiveOffDays === 0) {
            startOffDay = day;
          }
          consecutiveOffDays++;
          
          // 최대 연속 휴무일 초과 시 강제 근무 배치 (모든 간호사)
          if (consecutiveOffDays > maxConsecutiveOffDays) {
            const workTypes = ['D', 'E', 'N'];
            const selectedWorkType = selectWorkTypeByPreference(workTypes, nurse);
            schedule[nurse.id][day] = selectedWorkType;
            console.log(`${nurse.name}: 최대 연속 휴무일 초과로 ${day}일 강제 ${selectedWorkType} 배치 (선호 근무 고려)`);
            consecutiveOffDays = 0;
          }
        } else {
          consecutiveOffDays = 0;
        }
      }
    }
  });
}

// 연속근무일/연속휴무일 제약조건 강제 적용
export function enforceConsecutiveWorkOffLimits(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints
): void {
  console.log('=== 연속근무일/연속휴무일 제약조건 강제 적용 ===');
  
  nurses.forEach(nurse => {
    console.log(`=== ${nurse.name} 연속근무일/연속휴무일 제약조건 적용 ===`);
    
    // 야간전담 간호사는 제외 (N과 O만 가능, 휴무일 제한 무시)
    if (nurse.nightDedicated) {
      console.log(`${nurse.name}: 야간전담 간호사 - 연속근무일/연속휴무일 제약조건 적용 제외 (휴무일 제한 무시)`);
      return;
    }
    // AN 제외
    if (nurse.position === 'AN') {
      console.log(`${nurse.name}: AN - 연속근무/휴무 제한 적용 제외`);
      return;
    }
    
    const maxConsecutiveDays = constraints.maxConsecutiveDays;
    const maxConsecutiveOffDays = constraints.maxConsecutiveOffDays || 3;
    
    // RN의 N근무 제한 (월 최대 1회)
    let rnNWorkCount = 0;
    const maxRNNWork = 1;
    
    // 현재 RN의 N근무 개수 계산
    if (nurse.position === 'RN') {
      daysInMonth.forEach(day => {
        if (schedule[nurse.id][day] === 'N') {
          rnNWorkCount++;
        }
      });
      console.log(`${nurse.name}: 현재 RN N근무 개수: ${rnNWorkCount}/${maxRNNWork}`);
    }
    
    let consecutiveWorkDays = 0;
    let consecutiveOffDays = 0;
    let startWorkDay = -1;
    let startOffDay = -1;
    
    // 1단계: 연속근무일 제한 적용
    for (let i = 0; i < daysInMonth.length; i++) {
      const day = daysInMonth[i];
      const workType = schedule[nurse.id][day];
      
      if (workType && workType !== 'O' && workType !== '-') {
        if (consecutiveWorkDays === 0) {
          startWorkDay = day;
        }
        consecutiveWorkDays++;
        consecutiveOffDays = 0;
        
        // 최대 연속근무일 초과 시 강제 휴무 배치 (무조건 적용)
        if (consecutiveWorkDays > maxConsecutiveDays) {
          schedule[nurse.id][day] = 'O';
          console.log(`${nurse.name}: 최대 연속근무일 초과로 ${day}일 강제 O 배치 (${consecutiveWorkDays}일 > ${maxConsecutiveDays}일) - 무조건 적용`);
          consecutiveWorkDays = 0;
          consecutiveOffDays = 1;
        }
      } else {
        consecutiveWorkDays = 0;
      }
    }
    
    // 2단계: 연속휴무일 제한 적용
    consecutiveWorkDays = 0;
    consecutiveOffDays = 0;
    
    for (let i = 0; i < daysInMonth.length; i++) {
      const day = daysInMonth[i];
      const workType = schedule[nurse.id][day];
      
      if (workType === 'O') {
        if (consecutiveOffDays === 0) {
          startOffDay = day;
        }
        consecutiveOffDays++;
        consecutiveWorkDays = 0;
        
        // 최대 연속휴무일 초과 시 강제 근무 배치 (무조건 적용)
        if (consecutiveOffDays > maxConsecutiveOffDays) {
          // 가능한 근무 유형 중에서 선택
          const availableWorkTypes = getAvailableWorkTypes(nurse, day, false, false);
          
          // 제약사항 적용: N 다음에는 O 2개, E 다음에는 D 금지
          let filteredWorkTypes = applyWorkTypeConstraints(availableWorkTypes, schedule[nurse.id], day, daysInMonth);
          
          // RN의 N근무 제한 적용
          if (nurse.position === 'RN' && rnNWorkCount >= maxRNNWork) {
            filteredWorkTypes = filteredWorkTypes.filter(workType => workType !== 'N');
            console.log(`${nurse.name}: RN N근무 제한으로 N 제외 (현재 ${rnNWorkCount}/${maxRNNWork})`);
          }
          
          if (filteredWorkTypes.length > 0) {
            // 선호 근무를 고려한 근무 유형 선택
            const selectedWorkType = selectWorkTypeByPreference(filteredWorkTypes, nurse);
            schedule[nurse.id][day] = selectedWorkType;
            console.log(`${nurse.name}: 최대 연속휴무일 초과로 ${day}일 강제 ${selectedWorkType} 배치 (${consecutiveOffDays}일 > ${maxConsecutiveOffDays}일) - 무조건 적용`);
            
            // N 근무 배치 시 다음 2일을 자동으로 O로 설정
            if (selectedWorkType === 'N') {
              // RN의 N근무 카운트 증가
              if (nurse.position === 'RN') {
                rnNWorkCount++;
                console.log(`${nurse.name}: RN N근무 카운트 증가 (${rnNWorkCount}/${maxRNNWork})`);
              }
              
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
            
            consecutiveOffDays = 0;
            consecutiveWorkDays = 1;
          } else {
            // 가능한 근무 유형이 없으면 D로 강제 변경 (무조건 적용)
            schedule[nurse.id][day] = 'D';
            console.log(`${nurse.name}: 최대 연속휴무일 초과로 ${day}일 강제 D 배치 (${consecutiveOffDays}일 > ${maxConsecutiveOffDays}일) - 무조건 적용`);
            consecutiveOffDays = 0;
            consecutiveWorkDays = 1;
          }
        }
      } else {
        consecutiveOffDays = 0;
      }
    }
    
    // 3단계: 최소 근무일수 보장 확인 및 강제 적용
    const totalDays = daysInMonth.length;
    const minOffDays = constraints.minDaysOff;
    const minWorkDays = totalDays - (minOffDays + 2); // 최소 근무일수 = 총 일수 - (최소 휴무일 + 2)
    
    let currentWorkDays = 0;
    daysInMonth.forEach(day => {
      const workType = schedule[nurse.id][day];
      if (workType && workType !== 'O' && workType !== '-') {
        currentWorkDays++;
      }
    });
    
    if (currentWorkDays < minWorkDays) {
      console.log(`${nurse.name}: 최소 근무일수 부족 (${currentWorkDays}/${minWorkDays}), 강제 근무 배치 시작`);
      
      const neededWorkDays = minWorkDays - currentWorkDays;
      let addedWorkDays = 0;
      
      for (let i = 0; i < daysInMonth.length && addedWorkDays < neededWorkDays; i++) {
        const day = daysInMonth[i];
        
        // 빈 스케줄이거나 휴무인 경우에만 근무로 변경
        if (schedule[nurse.id][day] === '-' || schedule[nurse.id][day] === 'O') {
          const availableWorkTypes = getAvailableWorkTypes(nurse, day, false, false);
          let filteredWorkTypes = applyWorkTypeConstraints(availableWorkTypes, schedule[nurse.id], day, daysInMonth);
          
          // RN의 N근무 제한 적용
          if (nurse.position === 'RN' && rnNWorkCount >= maxRNNWork) {
            filteredWorkTypes = filteredWorkTypes.filter(workType => workType !== 'N');
            console.log(`${nurse.name}: RN N근무 제한으로 N 제외 (현재 ${rnNWorkCount}/${maxRNNWork})`);
          }
          
          if (filteredWorkTypes.length > 0) {
            const selectedWorkType = selectWorkTypeByPreference(filteredWorkTypes, nurse);
            schedule[nurse.id][day] = selectedWorkType;
            addedWorkDays++;
            
            console.log(`${nurse.name}: 최소 근무일수 보장을 위해 ${day}일 ${selectedWorkType} 강제 배치`);
            
            // N 근무 배치 시 카운트 증가 및 다음 2일 O 설정
            if (selectedWorkType === 'N') {
              if (nurse.position === 'RN') {
                rnNWorkCount++;
                console.log(`${nurse.name}: RN N근무 카운트 증가 (${rnNWorkCount}/${maxRNNWork})`);
              }
              
              const nextDay1 = day + 1;
              const nextDay2 = day + 2;
              
              if (nextDay1 <= daysInMonth.length && schedule[nurse.id][nextDay1] === '-') {
                schedule[nurse.id][nextDay1] = 'O';
              }
              if (nextDay2 <= daysInMonth.length && schedule[nurse.id][nextDay2] === '-') {
                schedule[nurse.id][nextDay2] = 'O';
              }
            }
          }
        }
      }
      
      console.log(`${nurse.name}: 최소 근무일수 보장 완료 - 추가 근무: ${addedWorkDays}일`);
    }
    
    console.log(`${nurse.name}: 연속근무일/연속휴무일 제약조건 적용 완료`);
  });
}

// N 근무 다음 OO 제약조건 강제 적용 (모든 간호사)
export function enforceNOOConstraint(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): void {
  console.log('=== N 근무 다음 OO 제약조건 강제 적용 (모든 간호사) ===');
  
  nurses.forEach(nurse => {
    if (nurse.position === 'AN') return; // AN 제외
    console.log(`=== ${nurse.name} N 근무 다음 OO 제약조건 적용 ===`);
    
    let changedCount = 0;
    
    // 각 날짜를 순회하면서 N 근무 다음 2일을 O로 강제 설정
    for (let i = 0; i < daysInMonth.length - 2; i++) {
      const day = daysInMonth[i];
      const workType = schedule[nurse.id][day];
      
      if (workType === 'N') {
        const nextDay1 = day + 1;
        const nextDay2 = day + 2;
        
        // 다음 2일이 월 범위 내에 있는지 확인
        if (nextDay1 <= daysInMonth.length && nextDay2 <= daysInMonth.length) {
          // 다음 2일이 O가 아닌 경우 강제로 O로 변경 (모든 간호사)
          if (schedule[nurse.id][nextDay1] !== 'O') {
            schedule[nurse.id][nextDay1] = 'O';
            changedCount++;
            console.log(`${nurse.name}: N 근무 후 ${nextDay1}일을 강제 O로 변경 (N-OO 제약조건, 기존: ${schedule[nurse.id][nextDay1]})`);
          }
          
          if (schedule[nurse.id][nextDay2] !== 'O') {
            schedule[nurse.id][nextDay2] = 'O';
            changedCount++;
            console.log(`${nurse.name}: N 근무 후 ${nextDay2}일을 강제 O로 변경 (N-OO 제약조건, 기존: ${schedule[nurse.id][nextDay2]})`);
          }
        }
      }
    }
    
    console.log(`${nurse.name}: N 근무 다음 OO 제약조건 적용 완료 (${changedCount}개 변경)`);
  });
}

// E-D 근무 금지 강제 적용
export function enforceEDProhibition(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[]
): void {
  console.log('=== E-D 근무 금지 강제 적용 ===');
  
  nurses.forEach(nurse => {
    if (nurse.position === 'AN') return; // AN 제외
    console.log(`=== ${nurse.name} E-D 근무 금지 적용 ===`);
    
    let changedCount = 0;
    
    // 각 날짜를 순회하면서 E 다음 D 근무를 찾아서 변경
    for (let i = 0; i < daysInMonth.length - 1; i++) {
      const currentDay = daysInMonth[i];
      const nextDay = daysInMonth[i + 1];
      
      const currentWorkType = schedule[nurse.id][currentDay];
      const nextWorkType = schedule[nurse.id][nextDay];
      
      // E 다음에 D가 오는 경우를 찾아서 변경
      if (currentWorkType === 'E' && nextWorkType === 'D') {
        // D를 다른 근무로 변경 (O, E, N 중 선택)
        const alternativeWorkTypes = ['O', 'E', 'N'];
        
        // AN의 M 가용 여부에 따라 M 포함
        if (nurse.workAvailability?.M) {
          alternativeWorkTypes.push('M');
        }
        
        // 선호 근무를 고려한 대안 선택
        const selectedAlternative = selectWorkTypeByPreference(alternativeWorkTypes, nurse);
        schedule[nurse.id][nextDay] = selectedAlternative;
        changedCount++;
        console.log(`${nurse.name}: ${nextDay}일 E-D 금지로 D를 ${selectedAlternative}로 변경`);
      }
    }
    
    console.log(`${nurse.name}: E-D 근무 금지 적용 완료 (${changedCount}개 변경)`);
  });
}

// 최대 OFF 개수 제한 적용 (최소휴무일 + 2까지만 허용)
export function applyMaxOffDaysLimit(
  nurses: Nurse[],
  schedule: { [nurseId: number]: { [day: number]: string } },
  daysInMonth: number[],
  constraints: ScheduleConstraints
): void {
  console.log('=== 최대 OFF 개수 제한 적용 ===');
  
  nurses.forEach(nurse => {
    console.log(`=== ${nurse.name} 최대 OFF 개수 제한 적용 ===`);
    
    // 야간전담 간호사는 제외 (N과 O만 가능, 휴무일 제한 무시)
    if (nurse.nightDedicated) {
      console.log(`${nurse.name}: 야간전담 간호사 - 최대 OFF 개수 제한 적용 제외 (휴무일 제한 무시)`);
      return;
    }
    
    // RN의 N근무 제한 (월 최대 1회)
    let rnNWorkCount = 0;
    const maxRNNWork = 1;
    
    // 현재 RN의 N근무 개수 계산
    if (nurse.position === 'RN') {
      daysInMonth.forEach(day => {
        if (schedule[nurse.id][day] === 'N') {
          rnNWorkCount++;
        }
      });
      console.log(`${nurse.name}: 현재 RN N근무 개수: ${rnNWorkCount}/${maxRNNWork}`);
    }
    
    // 현재 OFF 개수 계산
    let currentOffCount = 0;
    daysInMonth.forEach(day => {
      if (schedule[nurse.id][day] === 'O') {
        currentOffCount++;
      }
    });
    
  // 최대 허용 OFF 개수 (최소휴무일로 제한)
  const maxAllowedOffDays = constraints.minDaysOff;
    
    console.log(`${nurse.name}: 현재 OFF 개수 ${currentOffCount}, 최대 허용 ${maxAllowedOffDays}`);
    
    // OFF 개수가 최대 허용 개수를 초과하는 경우
    if (currentOffCount > maxAllowedOffDays) {
      const excessOffDays = currentOffCount - maxAllowedOffDays;
      console.log(`${nurse.name}: OFF 개수 초과 (${excessOffDays}개 초과), 근무로 변경 시작`);
      
      // 초과된 OFF 개수만큼 근무로 변경
      let changedCount = 0;
      for (let day of daysInMonth) {
        if (changedCount >= excessOffDays) break;
        
        if (schedule[nurse.id][day] === 'O') {
          // 미리 입력된 스케줄이 아닌 경우에만 변경
          const existingSchedule = schedule[nurse.id][day];
          if (!existingSchedule || existingSchedule === 'O') {
            // 가능한 근무 유형 중에서 선택 (AN 제외)
            if (nurse.position === 'AN') {
              continue;
            }
            const availableWorkTypes = getAvailableWorkTypes(nurse, day, false, false);
            
            // 제약사항 적용: N 다음에는 O 2개, E 다음에는 D 금지
            let filteredWorkTypes = applyWorkTypeConstraints(availableWorkTypes, schedule[nurse.id], day, daysInMonth);
            
            // RN의 N근무 제한 적용
            if (nurse.position === 'RN' && rnNWorkCount >= maxRNNWork) {
              filteredWorkTypes = filteredWorkTypes.filter(workType => workType !== 'N');
              console.log(`${nurse.name}: RN N근무 제한으로 N 제외 (현재 ${rnNWorkCount}/${maxRNNWork})`);
            }
            
            if (filteredWorkTypes.length > 0) {
              // 선호 근무를 고려한 근무 유형 선택
              const selectedWorkType = selectWorkTypeByPreference(filteredWorkTypes, nurse);
              schedule[nurse.id][day] = selectedWorkType;
              changedCount++;
              console.log(`${nurse.name}: ${day}일 O를 ${selectedWorkType}로 변경 (${changedCount}/${excessOffDays})`);
              
              // N 근무 배치 시 카운트 증가 및 다음 2일을 자동으로 O로 설정
              if (selectedWorkType === 'N') {
                if (nurse.position === 'RN') {
                  rnNWorkCount++;
                  console.log(`${nurse.name}: RN N근무 카운트 증가 (${rnNWorkCount}/${maxRNNWork})`);
                }
                
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
              changedCount++;
              console.log(`${nurse.name}: ${day}일 O를 D로 강제 변경 (${changedCount}/${excessOffDays})`);
            }
          }
        }
      }
      
      console.log(`${nurse.name}: OFF 개수 제한 적용 완료 (${changedCount}개 변경)`);
    } else {
      console.log(`${nurse.name}: OFF 개수 정상 (${currentOffCount}/${maxAllowedOffDays})`);
    }
  });
}
