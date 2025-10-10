'use client';

import Link from 'next/link';
import { getNurses, addNurse, updateNurse, deleteNurse, updateNurseVacation } from './action';

export default function NursePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 */}
      <nav className="nav bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* 달력 이동 */}
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
          <h2 className="text-lg font-semibold text-gray-900 mb-6">간호사 관리</h2>
          
          <div className="text-center text-gray-500 py-12">
            <div className="text-4xl mb-4">👩‍⚕️</div>
            <p className="text-lg font-medium mb-2">간호사 관리 기능</p>
            <p className="text-sm">간호사 추가, 수정, 삭제 기능이 여기에 구현됩니다.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
