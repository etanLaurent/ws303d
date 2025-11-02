// ------------------
// Création carte Leaflet
const map = L.map('map').setView([46.8, 2.5], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; CartoDB, OpenStreetMap'
}).addTo(map);

// ------------------
// Variables globales
let geojsonLayer;
let departementsGeoJSON;
const temperatureData = {};
const months = [];
let tempChartInstance = null; // Chart.js instance pour le panneau

// Génération des mois avec limite à septembre 2025
for (let y = 2018; y <= 2025; y++) {
    const maxMonth = y === 2025 ? 9 : 12; // Limiter à septembre pour 2025
    for (let m = 1; m <= maxMonth; m++) {
        months.push(`${y}-${String(m).padStart(2, '0')}`);
    }
}

// ------------------
// Charger automatiquement tous les CSV du dossier /data
async function loadAllData() {
  const response = await fetch('../data/');
  const text = await response.text();

  // Si ton serveur ne liste pas les fichiers automatiquement, on peut forcer ici :
  // Mets manuellement les fichiers à charger :
  const csvFiles = [
    '01_ain.csv','02_aisne.csv','03_allier.csv','04_alpes-de-haute-provence.csv',
    '05_hautes-alpes.csv','06_alpes-maritimes.csv','07_ardeche.csv','08_ardennes.csv',
    '09_ariege.csv','10_aube.csv','11_aude.csv','12_aveyron.csv','13_bouches-du-rhone.csv',
    '14_calvados.csv','15_cantal.csv','16_charente.csv','17_charente-maritime.csv',
    '18_cher.csv','19_correze.csv','21_cote-dor.csv','22_cotes-darmor.csv','23_creuse.csv',
    '24_dordogne.csv','25_doubs.csv','26_drome.csv','27_eure.csv','28_eure-et-loir.csv',
    '29_finistere.csv','2A_corse-du-sud.csv','2B_haute-corse.csv','30_gard.csv',
    '31_haute-garonne.csv','32_gers.csv','33_gironde.csv','34_herault.csv','35_ille-et-vilaine.csv',
    '36_indre.csv','37_indre-et-loire.csv','38_isere.csv','39_jura.csv','40_landes.csv',
    '41_loir-et-cher.csv','42_loire.csv','43_haute-loire.csv','44_loire-atlantique.csv',
    '45_loiret.csv','46_lot.csv','47_lot-et-garonne.csv','48_lozere.csv','49_maine-et-loire.csv',
    '50_manche.csv','51_marne.csv','52_haute-marne.csv','53_mayenne.csv','54_meurthe-et-moselle.csv',
    '55_meuse.csv','56_morbihan.csv','57_moselle.csv','58_nievre.csv','59_nord.csv',
    '60_oise.csv','61_orne.csv','62_pas-de-calais.csv','63_puy-de-dome.csv','64_pyrenees-atlantiques.csv',
    '65_hautes-pyrenees.csv','66_pyrenees-orientales.csv','67_bas-rhin.csv','68_haut-rhin.csv',
    '69_rhone.csv','70_haute-saone.csv','71_saone-et-loire.csv','72_sarthe.csv','73_savoie.csv',
    '74_haute-savoie.csv','75_paris.csv','76_seine-maritime.csv','77_seine-et-marne.csv','78_yvelines.csv',
    '79_deux-sevres.csv','80_somme.csv','81_tarn.csv','82_tarn-et-garonne.csv','83_var.csv',
    '84_vaucluse.csv','85_vendee.csv','86_vienne.csv','87_haute-vienne.csv','88_vosges.csv',
    '89_yonne.csv','90_territoire-de-belfort.csv','91_essonne.csv','92_hauts-de-seine.csv',
    '93_seine-saint-denis.csv','94_val-de-marne.csv','95_val-doise.csv'
  ];

  for (const file of csvFiles) {
    const code = file.split('_')[0];
    const url = `../data/${file}`;
    try {
      const response = await fetch(url);
      const text = await response.text();
      const result = Papa.parse(text, { header: true, delimiter: ';' });

      temperatureData[code] = {};
      result.data.forEach(row => {
        const mois = row['Année-Mois'];
        const t = parseFloat(row['TMoy (°C)']);
        if (mois && !isNaN(t)) temperatureData[code][mois] = t;
      });
    } catch (e) {
      console.warn(`Fichier ${file} manquant ou invalide`);
    }
  }
}

// ------------------
// Fonction couleur
function getColor(temp) {
  if (temp == null) return '#cccccc';
  return temp > 25 ? '#BD0026' :
         temp > 20 ? '#E31A1C' :
         temp > 15 ? '#FD8D3C' :
         temp > 10 ? '#FED976' :
         temp > 5  ? '#33b6d3ff' :
         temp > 0  ? '#2d7cb0ff':
                     '#2d43b0ff';
}

// ------------------
// Mise à jour de la carte
function updateMap(selectedMonth) {
  if (geojsonLayer) geojsonLayer.remove();

  geojsonLayer = L.geoJson(departementsGeoJSON, {
    style: feature => {
      const code = feature.properties.code;
      const temp = temperatureData[code]?.[selectedMonth];
      return {
        fillColor: getColor(temp),
        weight: 1,
        color: '#555',
        fillOpacity: 0.8
      };
    },
    onEachFeature: (feature, layer) => {
      const code = feature.properties.code;
      const temp = temperatureData[code]?.[selectedMonth];
      
      layer.on('click', () => {
        const sidebar = document.getElementById('sidebar');
        const mapElement = document.getElementById('map');
        const content = document.getElementById('sidebarContent');
        
        content.innerHTML = `
          <div class="sidebar__header">
            <h2 class="sidebar__dept-name">${feature.properties.nom}</h2>
          </div>
          
          <div class="sidebar__info">
            <p><strong>Code:</strong> ${code}</p>
            <p><strong>Température:</strong> ${temp ?? 'N/A'} °C</p>
            <p><strong>Mois:</strong> ${selectedMonth}</p>
          </div>

          <div class="sidebar__charts">
              <section class="chart-card">
                <h3 class="chart-card__title">Évolution de la température</h3>
                <div class="chart-card__placeholder">
                  <!-- Canvas pour Chart.js -->
                  <canvas id="tempChart" aria-label="Graphique température moyenne mensuelle" role="img"></canvas>
                </div>
                <p class="chart-card__text">Graphique montrant l'évolution de la température moyenne mensuelle pour ce département.</p>
              </section>

            <section class="chart-card">
              <h3 class="chart-card__title">Comparaison nationale</h3>
              <div class="chart-card__placeholder"></div>
              <p class="chart-card__text">Comparaison des températures avec la moyenne nationale.</p>
            </section>

            <section class="chart-card">
              <h3 class="chart-card__title">Tendances annuelles</h3>
              <div class="chart-card__placeholder"></div>
              <p class="chart-card__text">Analyse des tendances de réchauffement sur la période 2018-2025.</p>
            </section>
          </div>
        `;
        
        sidebar.classList.add('open');
        mapElement.classList.add('sidebar-open');
        
        // Recentrer la carte après un court délai pour laisser l'animation se terminer
        setTimeout(() => {
          map.invalidateSize();
          const bounds = layer.getBounds();
          map.fitBounds(bounds);
          // Après que le panneau soit ouvert et la taille recalculée, créer le graphique
          try {
            createDeptChart(code, feature.properties.nom);
          } catch (e) {
            console.error('Erreur création graphique :', e);
          }
        }, 300);
      });

      layer.bindPopup(`${feature.properties.nom}<br><b>${temp ?? 'N/A'} °C</b>`);
    }
  }).addTo(map);
}

// Modifier la fonction de fermeture du panneau
document.getElementById('closeSidebar')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const mapElement = document.getElementById('map');
  sidebar.classList.remove('open');
  mapElement.classList.remove('sidebar-open');
  
  // Recentrer la carte sur la France après fermeture du panneau
  setTimeout(() => {
    map.invalidateSize();
    map.setView([46.8, 2.5], 6);
  }, 300);
});

// ------------------
// Charger GeoJSON + données
fetch('geo/departements.geojson')
  .then(r => r.json())
  .then(async data => {
    departementsGeoJSON = data;
    await loadAllData();
    updateMap(months[0]); // premier mois
  });

// ------------------
// Slider : mise à jour du mois
const slider = document.getElementById('monthSlider');
const label = document.getElementById('monthLabel');
slider.max = months.length - 1;
slider.addEventListener('input', e => {
  const month = months[e.target.value];
  label.textContent = month;
  updateMap(month);
});

// Crée ou met à jour le chart pour un département donné en utilisant temperatureData
function createDeptChart(deptCode, deptName) {
  // labels = months (Année-Mois)
  const labels = months.slice();
  const values = labels.map(m => {
    const v = temperatureData[deptCode]?.[m];
    // Garder null pour les valeurs manquantes pour que Chart.js laisse un trou
    return (v === undefined) ? null : v;
  });

  // Détruire l'instance précédente si existante
  if (tempChartInstance) {
    try { tempChartInstance.destroy(); } catch (e) { /* ignore */ }
    tempChartInstance = null;
  }

  const canvas = document.getElementById('tempChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Création d'un dégradé vertical pour la ligne
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 260);
  gradient.addColorStop(0, '#BD0026'); // rouge chaud
  gradient.addColorStop(0.5, 'orange');
  gradient.addColorStop(1, '#33b6d3'); // bleu clair

  // Couleurs des points selon la température (utilise getColor)
  const pointBg = values.map(v => (v === null) ? '#ffffff' : getColor(v));
  const pointBorder = values.map(v => (v === null) ? '#cccccc' : '#222');

  // Configuration Chart.js avec couleurs
  const cfg = {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'TMoy (°C)',
        data: values,
        borderColor: gradient,
        backgroundColor: 'rgba(255,165,0,0.12)',
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: pointBg,
        pointBorderColor: pointBorder,
        pointBorderWidth: 1,
        spanGaps: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: `Température moyenne mensuelle – ${deptName}`
        },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              return (v === null) ? 'N/A' : `${v} °C`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Mois / Année' },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }
        },
        y: {
          title: { display: true, text: 'Température (°C)' }
        }
      }
    }
  };

  // Ajuster la hauteur du canvas parent pour que le graphique ait une taille visible
  const placeholder = canvas.parentElement;
  if (placeholder) placeholder.style.height = '260px';

  tempChartInstance = new Chart(ctx, cfg);
}
