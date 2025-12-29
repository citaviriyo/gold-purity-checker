"use client";

import React, { useMemo, useState } from "react";
import { Search, Droplet, Scale, Info, AlertCircle } from "lucide-react";

type ConversionRow = {
  karat: string; // "24K"
  percent: number; // 99.9
  minDensity: number;
  maxDensity: number;
};

type BadgeInfo = {
  label: string;
  color: string; // tailwind classes
  note: string;
};

type CalcResult = {
  density: string;
  goldPercent: string;

  karatFromPercent: string; // "17.7K"
  karatFromDensity: string; // "20K" or "?"
  karatRangeDensity: string; // "16.20 - 16.90 g/cm³" or ""

  finalRange: string; // "18K–20K"
  badgeLabel: string;
  badgeColor: string;
  conclusionText: string;

  deltaKarat: string; // "2.3K"
  deltaLabel: "OK" | "WASPADA";
  deltaNote: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseKaratLabel(karatStr: string): number | null {
  // "20K" -> 20
  const m = karatStr.trim().toUpperCase().match(/^(\d+(\.\d+)?)K$/);
  if (!m) return null;
  return Number(m[1]);
}

function getBadgeForRange(minK: number, maxK: number): BadgeInfo {
  const avg = (minK + maxK) / 2;

  if (avg >= 22) {
    return {
      label: "Sangat Tinggi",
      color: "bg-emerald-600 text-white",
      note: "Mendekati emas murni (umumnya 22K+).",
    };
  }
  if (avg >= 18) {
    return {
      label: "Tinggi",
      color: "bg-green-600 text-white",
      note: "Kadar tinggi (umumnya 18K–21K).",
    };
  }
  if (avg >= 14) {
    return {
      label: "Menengah",
      color: "bg-amber-500 text-white",
      note: "Kadar menengah (umumnya 14K–17K).",
    };
  }
  if (avg >= 10) {
    return {
      label: "Rendah",
      color: "bg-orange-600 text-white",
      note: "Kadar rendah (umumnya 10K–13K).",
    };
  }
  return {
    label: "Sangat Rendah",
    color: "bg-red-600 text-white",
    note: "Kadar sangat rendah (di bawah 10K).",
  };
}

function computeFinalRange(params: {
  karatFromPercent: number; // angka
  karatFromDensity: number | null; // angka atau null
}) {
  const { karatFromPercent, karatFromDensity } = params;

  // Range final: gabungan estimasi
  // - Dari persen: ±1K (biar tidak terlalu “pasti”)
  // - Dari densitas: ±1K (karena range tabel & alloy)
  // Kemudian kita ambil min–max gabungan, clamp 0..24
  const pMin = clamp(karatFromPercent - 1, 0, 24);
  const pMax = clamp(karatFromPercent + 1, 0, 24);

  let minK = pMin;
  let maxK = pMax;

  if (karatFromDensity !== null) {
    const dMin = clamp(karatFromDensity - 1, 0, 24);
    const dMax = clamp(karatFromDensity + 1, 0, 24);
    minK = Math.min(minK, dMin);
    maxK = Math.max(maxK, dMax);
  }

  // rapihin: bulatkan ke 0.5K biar enak dibaca
  const roundHalf = (x: number) => Math.round(x * 2) / 2;
  minK = roundHalf(minK);
  maxK = roundHalf(maxK);

  // jangan sampai min > max
  if (minK > maxK) [minK, maxK] = [maxK, minK];

  return { minK, maxK, label: `${minK}K–${maxK}K` };
}

function getDeltaIndicator(karatFromPercent: number, karatFromDensity: number | null) {
  if (karatFromDensity === null) {
    return {
      delta: "",
      label: "OK" as const,
      note: "Tidak ada pembanding densitas (di luar range tabel).",
    };
  }

  const delta = Math.abs(karatFromPercent - karatFromDensity);
  const deltaRounded = Math.round(delta * 10) / 10;

  // Threshold: >= 2K dianggap beda besar
  if (deltaRounded >= 2.0) {
    return {
      delta: `${deltaRounded.toFixed(1)}K`,
      label: "WASPADA" as const,
      note: "Selisih besar. Bisa dipengaruhi batu permata, solder, rongga/berlubang, gelembung air, atau teknik penimbangan.",
    };
  }

  return {
    delta: `${deltaRounded.toFixed(1)}K`,
    label: "OK" as const,
    note: "Selisih kecil. Hasil cenderung konsisten untuk screening cepat.",
  };
}

export default function GoldPurityChecker() {
  const [airWeight, setAirWeight] = useState<string>("");
  const [waterWeight, setWaterWeight] = useState<string>("");
  const [waterTemp, setWaterTemp] = useState<string>("20");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [result, setResult] = useState<CalcResult | null>(null);

  /**
   * Tabel karat 24K → 6K
   * Percent: standar K/24 * 100 (24K pakai 99.9).
   * Density range: heuristik/approx untuk edukasi & screening cepat.
   */
  const conversionTable: ConversionRow[] = [
    { karat: "24K", percent: 99.9, minDensity: 19.20, maxDensity: 19.32 },
    { karat: "23K", percent: 95.8, minDensity: 18.60, maxDensity: 19.20 },
    { karat: "22K", percent: 91.7, minDensity: 17.70, maxDensity: 18.60 },
    { karat: "21K", percent: 87.5, minDensity: 16.90, maxDensity: 17.70 },
    { karat: "20K", percent: 83.3, minDensity: 16.20, maxDensity: 16.90 },
    { karat: "19K", percent: 79.2, minDensity: 15.60, maxDensity: 16.20 },
    { karat: "18K", percent: 75.0, minDensity: 15.20, maxDensity: 15.60 },
    { karat: "17K", percent: 70.8, minDensity: 14.70, maxDensity: 15.20 },
    { karat: "16K", percent: 66.7, minDensity: 14.20, maxDensity: 14.70 },
    { karat: "15K", percent: 62.5, minDensity: 13.70, maxDensity: 14.20 },
    { karat: "14K", percent: 58.3, minDensity: 13.00, maxDensity: 13.70 },
    { karat: "13K", percent: 54.2, minDensity: 12.60, maxDensity: 13.00 },
    { karat: "12K", percent: 50.0, minDensity: 12.00, maxDensity: 12.60 },
    { karat: "11K", percent: 45.8, minDensity: 11.60, maxDensity: 12.00 },
    { karat: "10K", percent: 41.7, minDensity: 11.30, maxDensity: 11.60 },
    { karat: "9K", percent: 37.5, minDensity: 10.90, maxDensity: 11.30 },
    { karat: "8K", percent: 33.3, minDensity: 10.50, maxDensity: 10.90 },
    { karat: "7K", percent: 29.2, minDensity: 10.10, maxDensity: 10.50 },
    { karat: "6K", percent: 25.0, minDensity: 9.70, maxDensity: 10.10 },
  ];

  const calculatePurity = () => {
    const air = Number.parseFloat(airWeight);
    const water = Number.parseFloat(waterWeight);

    if (Number.isNaN(air) || Number.isNaN(water) || air <= 0 || water <= 0) {
      alert("Masukkan angka yang valid untuk berat di udara dan berat di air.");
      return;
    }
    if (air <= water) {
      alert("Masukkan nilai yang valid. Berat di udara harus lebih besar dari berat di air.");
      return;
    }

    // Koreksi densitas air (pendekatan sederhana)
    const temp = Number.parseFloat(waterTemp);
    let waterDensity = 1.0;
    if (!Number.isNaN(temp)) {
      if (temp < 10) waterDensity = 0.9997;
      else if (temp > 30) waterDensity = 0.9957;
    }

    const volume = (air - water) / waterDensity;
    if (volume <= 0) {
      alert("Perhitungan gagal: volume <= 0. Cek ulang input & teknik penimbangan.");
      return;
    }

    const density = air / volume;

    // Estimasi % emas dari densitas (heuristik linear dari tabel min→max)
    const minD = 9.7; // ~6K
    const maxD = 19.32; // ~24K
    const goldPercent = clamp(((density - minD) / (maxD - minD)) * 100, 0, 100);

    // Karat dari persen
    const karatFromPercentNum = (goldPercent * 24) / 100;

    // Karat dari densitas: cari range tabel
    let karatFromDensity = "?";
    let karatRangeDensity = "";
    for (const row of conversionTable) {
      if (density >= row.minDensity && density <= row.maxDensity) {
        karatFromDensity = row.karat;
        karatRangeDensity = `${row.minDensity.toFixed(2)} - ${row.maxDensity.toFixed(2)} g/cm³`;
        break;
      }
    }

    const karatFromDensityNum = parseKaratLabel(karatFromDensity);

    // Range final + badge
    const final = computeFinalRange({
      karatFromPercent: karatFromPercentNum,
      karatFromDensity: karatFromDensityNum,
    });

    const badge = getBadgeForRange(final.minK, final.maxK);

    // indikator selisih
    const delta = getDeltaIndicator(karatFromPercentNum, karatFromDensityNum);

    // Kesimpulan pakai RANGE final
    const conclusionText = `Kesimpulan: perkiraan kadar emas berada di kisaran ${final.label} (${badge.label}). ${badge.note}`;

    setResult({
      density: density.toFixed(2),
      goldPercent: goldPercent.toFixed(1),

      karatFromPercent: `${karatFromPercentNum.toFixed(1)}K`,
      karatFromDensity,
      karatRangeDensity,

      finalRange: final.label,
      badgeLabel: badge.label,
      badgeColor: badge.color,
      conclusionText,

      deltaKarat: delta.delta,
      deltaLabel: delta.label,
      deltaNote: delta.note,
    });
  };

  const filteredTable = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return conversionTable;
    return conversionTable.filter(
      (item) =>
        item.karat.toLowerCase().includes(q) ||
        item.percent.toString().includes(q) ||
        `${item.minDensity} ${item.maxDensity}`.includes(q)
    );
  }, [searchTerm, conversionTable]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-100">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Scale className="w-8 h-8 text-amber-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Cek Kadar Emas</h1>
          </div>
          <p className="text-gray-600">Metode Hydrostatic Weighing (Timbangan Air)</p>
        </div>

        {/* Penjelasan Metode */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-3">Cara Kerja Metode Ini</h2>
              <ol className="space-y-3 text-gray-700">
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600">1.</span>
                  <span>
                    <strong>Timbang di udara:</strong> Catat berat perhiasan dalam keadaan kering (contoh 10.50 gram)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600">2.</span>
                  <span>
                    <strong>Timbang di air:</strong> Celupkan perhiasan sepenuhnya ke dalam air, pastikan tidak ada
                    gelembung. Catat beratnya (contoh 9.80 gram)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600">3.</span>
                  <span>
                    <strong>Hitung densitas:</strong> Densitas = Berat udara ÷ (Berat udara - Berat air)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600">4.</span>
                  <span>
                    <strong>Interpretasi:</strong> Sistem memberi range final + indikator selisih untuk screening cepat
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Form Input */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Droplet className="w-6 h-6 text-blue-600" />
            Input Data Penimbangan
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Berat di Udara (gram)</label>
              <input
                type="number"
                step="0.01"
                value={airWeight}
                onChange={(e) => setAirWeight(e.target.value)}
                placeholder="Contoh: 10.50"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none text-lg text-gray-900 placeholder-gray-400 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Berat di Air (gram)</label>
              <input
                type="number"
                step="0.01"
                value={waterWeight}
                onChange={(e) => setWaterWeight(e.target.value)}
                placeholder="Contoh: 9.80"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none text-lg text-gray-900 placeholder-gray-400 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Suhu Air (°C) - Opsional</label>
              <input
                type="number"
                value={waterTemp}
                onChange={(e) => setWaterTemp(e.target.value)}
                placeholder="20"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none text-lg text-gray-900 placeholder-gray-400 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default 20°C. Suhu mempengaruhi densitas air (koreksi sederhana).
              </p>
            </div>

            <button
              onClick={calculatePurity}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-bold py-4 rounded-lg hover:from-amber-600 hover:to-yellow-700 transition-all shadow-lg text-lg"
            >
              Hitung Kadar Emas
            </button>
          </div>
        </div>

        {/* Hasil */}
        {result && (
          <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl shadow-xl p-6 mb-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl font-bold">Hasil Perhitungan</h2>

              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${result.badgeColor}`}>
                {result.badgeLabel}
              </span>
            </div>

            <p className="text-sm text-white/95 mb-4 leading-relaxed">
              <strong>Range final:</strong> <span className="font-bold">{result.finalRange}</span> — {result.conclusionText}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Densitas</p>
                <p className="text-3xl font-bold">{result.density} g/cm³</p>
              </div>

              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Estimasi Kadar Emas</p>
                <p className="text-3xl font-bold">{result.goldPercent}%</p>
              </div>

              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Karat (dari persen)</p>
                <p className="text-3xl font-bold">{result.karatFromPercent}</p>
                <p className="text-xs mt-1 opacity-90">Rumus: K = % × 24 / 100</p>
              </div>

              <div className="bg-white/20 backdrop-blur rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Karat (dari densitas)</p>
                <p className="text-3xl font-bold">{result.karatFromDensity}</p>
                {result.karatRangeDensity ? (
                  <p className="text-sm mt-1">Range densitas: {result.karatRangeDensity}</p>
                ) : (
                  <p className="text-sm mt-1">Di luar range tabel</p>
                )}
              </div>
            </div>

            {/* Indikator selisih */}
            <div className="mt-4">
              <div className="bg-white/15 backdrop-blur rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                      result.deltaLabel === "WASPADA" ? "bg-red-600 text-white" : "bg-white/25 text-white"
                    }`}
                  >
                    Indikator Selisih: {result.deltaLabel}
                  </span>

                  {result.deltaKarat && (
                    <span className="text-xs text-white/90">
                      Selisih ≈ <strong>{result.deltaKarat}</strong>
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/95 leading-relaxed">{result.deltaNote}</p>
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-red-800 mb-2">Penting - Disclaimer</h3>
              <p className="text-sm text-red-700 leading-relaxed">
                Hasil perhitungan ini adalah <strong>estimasi edukasi</strong> dan tidak menggantikan pengujian profesional.
                Akurasi dipengaruhi alloy (perak/tembaga/nikel), batu permata, rongga, solder, serta teknik penimbangan.
                Untuk hasil akurat, gunakan XRF atau uji laboratorium.
              </p>
            </div>
          </div>
        </div>

        {/* Tabel Konversi */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Tabel Konversi Kadar Emas (24K → 6K)</h2>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari karat (mis. 18K) atau persen..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none text-gray-900 placeholder-gray-400 bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Karat</th>
                  <th className="px-4 py-3 text-left font-bold">Kadar (%)</th>
                  <th className="px-4 py-3 text-left font-bold">Densitas (g/cm³)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTable.map((item) => (
                  <tr key={item.karat} className="hover:bg-amber-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-amber-700">{item.karat}</td>
                    <td className="px-4 py-3 text-gray-800">{item.percent}%</td>
                    <td className="px-4 py-3 text-gray-700 text-sm">
                      {item.minDensity.toFixed(2)} - {item.maxDensity.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredTable.length === 0 && (
            <p className="text-center text-gray-500 py-8">Tidak ada hasil yang cocok dengan pencarian</p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>© 2025 - Alat Bantu Cek Kadar Emas</p>
          <p className="mt-1">Metode Hydrostatic Weighing untuk Edukasi</p>
        </div>
      </div>
    </div>
  );
}
