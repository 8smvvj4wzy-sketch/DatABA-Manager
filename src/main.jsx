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
   Enregistré après le chargement pour ne pas ralentir le premier affichage. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || './';
    navigator.serviceWorker.register(`${base}sw.js`).then(() => {
      /* On transmet la liste des fichiers réellement chargés : leurs noms
         portent une empreinte qui change à chaque version, le service worker
         ne peut donc pas les deviner. C'est ce qui rend le hors-ligne fiable
         dès la première visite. */
      const envoyer = () => {
        if (!navigator.serviceWorker.controller) return;
        const urls = performance
          .getEntriesByType('resource')
          .map((r) => r.name)
          .filter((u) => u.startsWith(window.location.origin))
          .filter((u) => /\.(js|css|woff2?|png|svg|webmanifest)(\?|$)/i.test(u));
        navigator.serviceWorker.controller.postMessage({ type: 'cache-assets', urls });
      };
      if (navigator.serviceWorker.controller) envoyer();
      else navigator.serviceWorker.addEventListener('controllerchange', envoyer);
    }).catch(() => {
      /* Sans HTTPS, l'enregistrement échoue : l'application fonctionne quand
         même, mais sans mode hors connexion. */
    });
  });
}
