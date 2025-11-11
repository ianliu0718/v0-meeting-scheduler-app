"use client"

import { Coffee } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

export function SponsorButton() {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div 
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 贊助連結 */}
      <a
        href="https://p.ecpay.com.tw/F52CB76"
        target="_blank"
        rel="noopener noreferrer"
        className="group"
      >
        {/* 主按鈕 */}
        <div className="relative">
          {/* Tooltip */}
          <div
            className={`absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-sm text-white shadow-lg transition-all duration-200 ${
              isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
            }`}
          >
            支持我們的開發 ☕
            <div className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 bg-gray-900"></div>
          </div>

          {/* 按鈕本體 */}
          <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 md:px-5 md:py-3.5">
            <Coffee className="h-5 w-5 text-white md:h-6 md:w-6" />
            <span className="font-medium text-white text-sm md:text-base">贊助我們</span>
          </div>
        </div>
      </a>

      {/* QR Code 彈出效果（桌面版） */}
      {isHovered && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 hidden md:block">
          <div className="rounded-lg bg-white p-3 shadow-2xl border border-gray-200">
            <Image
              src="https://payment.ecpay.com.tw/Upload/QRCode/202511/QRCode_66202634-ecea-4486-bd7c-4c7705bde3d5.png"
              alt="綠界贊助 QR Code"
              width={150}
              height={150}
              className="rounded"
            />
            <p className="mt-2 text-center text-xs text-gray-600">掃碼贊助</p>
          </div>
        </div>
      )}
    </div>
  )
}
