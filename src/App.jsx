@tailwind base;
@tailwind components;
@tailwind utilities;

@media print {
  .no-print { display: none !important; }
  /* Le document occupe toute la page, sans cadre ni ombre d'écran */
  body { background: #fff !important; }
  .rounded-2xl { border: none !important; padding: 0 !important; }
  @page { margin: 18mm 14mm; }
}
