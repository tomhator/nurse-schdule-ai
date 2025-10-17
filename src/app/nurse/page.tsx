'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getNurses, deleteNurse, Nurse } from './action';

export default function NursePage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);

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
                근무 조건 설정
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
                {nurses
                  .sort((a, b) => {
                    const positionOrder: { [key: string]: number } = { 'HN': 1, 'RN': 2, 'AN': 3 };
                    const positionDiff = positionOrder[a.position] - positionOrder[b.position];
                    if (positionDiff !== 0) {
                      return positionDiff;
                    }
                    return a.name.localeCompare(b.name);
                  })
                  .map((nurse) => (
                  <tr key={nurse.id} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-4 py-3 text-sm text-gray-900">{nurse.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{nurse.position}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {nurse.weekendWork ? '가능' : '불가'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {Object.entries(nurse.workAvailability)
                        .filter(([, available]) => available)
                        .map(([shift]) => shift)
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

    </div>
  );
}