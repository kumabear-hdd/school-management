import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface GradeExportRow {
  studentName: string;
  className: string;
  subjectName: string;
  componentSummary: string;
  finalScore: number;
  kkm: number;
  status: string;
}

export function exportGradesToExcel(rows: GradeExportRow[], filenamePrefix = 'Rekap_Nilai_Akademik') {
  const sheetData = rows.map((row, idx) => ({
    No: idx + 1,
    Nama_Siswa: row.studentName,
    Kelas: row.className,
    Mata_Pelajaran: row.subjectName,
    Rincian_Komponen: row.componentSummary,
    Nilai_Akhir: row.finalScore,
    KKM: row.kkm,
    Keterangan: row.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Nilai');
  XLSX.writeFile(workbook, `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportGradesToPdf(
  rows: GradeExportRow[],
  schoolName: string,
  subtitle: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(`Rekap Nilai Akademik — ${schoolName}`, 40, 42);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 40, 60);

  autoTable(doc, {
    startY: 76,
    head: [['No', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Komponen', 'Nilai Akhir', 'KKM', 'Keterangan']],
    body: rows.map((r, i) => [
      i + 1,
      r.studentName,
      r.className,
      r.subjectName,
      r.componentSummary,
      r.finalScore.toFixed(1),
      r.kkm,
      r.status,
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [15, 76, 129] },
  });

  doc.save(`Rekap_Nilai_Akademik_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface AssignmentRecapExportRow {
  assignmentTitle: string;
  subjectName: string;
  className: string;
  studentName: string;
  statusLabel: string;
  submittedAt: string;
  scoreLabel: string;
}

export function exportAssignmentRecapToExcel(rows: AssignmentRecapExportRow[]) {
  const sheetData = rows.map((row, idx) => ({
    No: idx + 1,
    Judul_Tugas: row.assignmentTitle,
    Mata_Pelajaran: row.subjectName,
    Kelas: row.className,
    Nama_Siswa: row.studentName,
    Status: row.statusLabel,
    Waktu_Kumpul: row.submittedAt,
    Nilai: row.scoreLabel,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap E-Tugas');
  XLSX.writeFile(workbook, `Rekap_E_Tugas_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportAssignmentRecapToPdf(
  rows: AssignmentRecapExportRow[],
  schoolName: string,
  subtitle: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(`Rekap Tugas Online (E-Tugas) — ${schoolName}`, 40, 42);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 40, 60);

  autoTable(doc, {
    startY: 76,
    head: [['No', 'Judul Tugas', 'Mata Pelajaran', 'Kelas', 'Nama Siswa', 'Status', 'Waktu Kumpul', 'Nilai']],
    body: rows.map((r, i) => [
      i + 1,
      r.assignmentTitle,
      r.subjectName,
      r.className,
      r.studentName,
      r.statusLabel,
      r.submittedAt,
      r.scoreLabel,
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [15, 76, 129] },
  });

  doc.save(`Rekap_E_Tugas_${new Date().toISOString().slice(0, 10)}.pdf`);
}
