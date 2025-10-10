'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getNurses, deleteNurse, Nurse } from './action';

export default function NursePage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  const [selectedNurse, setSelectedNurse] = useState<Nurse | null>(null);
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth() + 1);

  // 간호사 목록 불러오기
  useEffect(() => {
    const loadNurses = () => {
      const nursesData = getNurses();
      setNurses(nursesData);
    };
    loadNurses();
  }, []);



  // 간호사 삭제
  const handleDeleteNurse = (id: number) => {
    if (confirm('정말로 이 간호사를 삭제하시겠습니까?')) {
      const result = deleteNurse(id);
      if (result.success) {
        setNurses(getNurses());
        alert(result.message);
      } else {
        alert(result.message);
      }
    }
  };

  const openScheduleModal = (nurse: Nurse) => {
    setSelectedNurse(nurse);
    setViewYear(new Date().getFullYear());
    setViewMonth(new Date().getMonth() + 1);
    setCalendarOpen(true);
  };

  const closeScheduleModal = () => {
    setCalendarOpen(false);
    setSelectedNurse(null);
  };

  const getDaysInMonth = (year: number, month: number) => {
    const count = new Date(year, month, 0).getDate();
    return Array.from({ length: count }, (_, i) => i + 1);
  };

  const isWeekend = (year: number, month: number, day: number) => {
    const d = new Date(year, month - 1, day).getDay();
    return d === 0 || d === 6;
  };

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const getDayStatus = (nurse: Nurse | null, year: number, month: number, day: number) => {
    if (!nurse || !nurse.schedules) return '-';
    const y = nurse.schedules[year];
    if (!y) return '-';
    const m = y[month];
    if (!m) return '-';
    return m[day] || '-';
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 */}
      <nav className="nav bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 제목 */}
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">간호사 관리</h1>
            </div>

            {/* 우측 메뉴 */}
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                근무표
              </Link>
              <Link 
                href="/nurse"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                간호사 관리
              </Link>
              <Link 
                href="/staffing"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                일일 필수 근무 인원 설정
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 메인 바디 */}
      <main className="schedule max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">간호사 리스트</h2>
            <Link
              href="/nurse/new"
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
            >
              간호사 추가
            </Link>
          </div>


          {/* 간호사 리스트 */}
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">이름</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">직책</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">주말근무</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">근무가능</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">야간전담</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">잔여연차</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">액션</th>
                </tr>
              </thead>
              <tbody>
                {nurses.map((nurse) => (
                  <tr key={nurse.id} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-4 py-3 text-sm text-gray-900">{nurse.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{nurse.position}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {nurse.weekendWork ? '가능' : '불가'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {Object.entries(nurse.workAvailability)
                        .filter(([_, available]) => available)
                        .map(([shift, _]) => shift)
                        .join(', ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {nurse.nightDedicated ? '전담' : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                        {nurse.remainingVacation}일
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex space-x-2">
                        <Link
                          href={`/nurse/${nurse.id}/edit`}
                          className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                        >
                          수정
                        </Link>
                        <button
                          onClick={() => openScheduleModal(nurse)}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                        >
                          일정 보기
                        </button>
                        <button
                          onClick={() => handleDeleteNurse(nurse.id)}
                          className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nurses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              등록된 간호사가 없습니다.
            </div>
          )}
        </div>
      </main>

      {/* 일정 보기 모달 */}
      {calendarOpen && selectedNurse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeScheduleModal} />
          <div className="relative bg-white w-full max-w-3xl mx-4 rounded-lg shadow-lg border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">{selectedNurse.name} 일정</h3>
                <span className="text-gray-500 text-sm">(읽기 전용)</span>
              </div>
              <button onClick={closeScheduleModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50">이전</button>
                <div className="text-base font-medium text-gray-900">{viewYear}년 {viewMonth}월</div>
                <button onClick={nextMonth} className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50">다음</button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {['일','월','화','수','목','금','토'].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-gray-600 py-2">{d}</div>
                ))}
                {/* 달력 첫 주 시작 요일 보정 */}
                {(() => {
                  const firstDayDow = new Date(viewYear, viewMonth - 1, 1).getDay();
                  return Array.from({ length: firstDayDow }).map((_, i) => (
                    <div key={`empty-${i}`} className="py-3" />
                  ));
                })()}

                {getDaysInMonth(viewYear, viewMonth).map((day) => {
                  const status = getDayStatus(selectedNurse, viewYear, viewMonth, day);
                  const weekend = isWeekend(viewYear, viewMonth, day);
                  const color =
                    status === 'O' ? 'text-red-600' :
                    status === 'D' ? 'text-blue-600' :
                    status === 'E' ? 'text-orange-600' :
                    status === 'N' ? 'text-purple-600' :
                    status === 'M' ? 'text-green-600' : 'text-gray-400';
                  return (
                    <div key={day} className={`border border-gray-200 rounded p-2 h-20 flex flex-col ${weekend ? 'bg-gray-50' : ''}`}>
                      <div className={`text-xs font-medium ${weekend ? 'text-red-500' : 'text-gray-700'}`}>{day}</div>
                      <div className={`mt-auto text-xl font-semibold ${color}`}>{status}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
              <button onClick={closeScheduleModal} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}