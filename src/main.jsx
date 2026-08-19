import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/* Service worker : permet à l'application de fonctionner sans réseau.
   Enregistré après le chargement pour ne pas ralentir le premier affichage.
   La liste des fichiers à mettre en cache n'est plus dictée par la page — le
   build (vite.config.js, scripts/precache.mjs) l'injecte directement dans
   sw.js. La dicter ici obligeait à une visite en ligne complète et réussie
   avant que le hors-ligne fonctionne, et un ordre d'activation mal posé côté
   service worker faisait écrire cette liste dans un cache déjà promis à la
   suppression (voir CLAUDE.md, piège « Le hors-ligne ne se découvre pas à
   l'exécution ») : la page n'a donc plus rien à transmettre au premier
   chargement, seulement à interroger ensuite (CarteHorsLigne, src/App.jsx). */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || './';
    navigator.serviceWorker.register(`${base}sw.js`).catch(() => {
      /* Sans HTTPS, l'enregistrement échoue : l'application fonctionne quand
         même, mais sans mode hors connexion. */
    });
  });
}
