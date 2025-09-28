document.addEventListener('DOMContentLoaded', function() {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxr0IID6SNXKzrH0gMXTN2qEWmLnIx-iDRAr0KiBkDT8c43Rli4EIPaBUuf_LLewUgCnQ/exec';
    const ZAPIER_INSERT_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/624843/u11gttx/';

    const rittenLijstContainer = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    const successModal = document.getElementById('success-modal');
    const hoofdTitel = document.querySelector('h2#hoofdTitel');

    async function laadPagina() {
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('edit');
        if (editToken) {
            await renderBeheerWeergave(editToken);
        } else {
            await renderAlleRitten();
        }
    }

    async function renderAlleRitten() {
        rittenLijstContainer.innerHTML = '<p>Ritten worden geladen...</p>';
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?timestamp=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Kon de data niet ophalen.');
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
            
            let data = result.data;
            data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const vandaag = new Date();
            vandaag.setHours(0, 0, 0, 0);
            
            const activeData = data.filter(rit => {
                if (!rit.vertrekdatum) return false;
                const vertrekDatum = new Date(rit.vertrekdatum);
                const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
                return dagenVerschil <= 3;
            });
            
            const groepen = { vraag_lift: [], aanbod_lift: [], vraag_transport: [], aanbod_transport: [] };
            activeData.forEach(rit => groepen[rit.type]?.push(rit));
            
            renderGroep(groepen.vraag_lift, document.getElementById('vraag_lift_list'));
            renderGroep(groepen.aanbod_lift, document.getElementById('aanbod_lift_list'));
            renderGroep(groepen.vraag_transport, document.getElementById('vraag_transport_list'));
            renderGroep(groepen.aanbod_transport, document.getElementById('aanbod_transport_list'));
        } catch (error) {
            console.error('Fout bij laden:', error);
            rittenLijstContainer.innerHTML = `<p style="color:red; grid-column: 1 / -1;">Fout: ${error.message}. Probeer de pagina te vernieuwen.</p>`;
        }
    }
    
    function renderGroep(data, container) {
        if (!container) return;
        container.innerHTML = '';
        if (data.length === 0) {
            container.innerHTML = '<p><i>Geen oproepen in deze categorie.</i></p>';
        } else {
            data.forEach(rit => {
                const ritDiv = document.createElement('div');
                ritDiv.className = 'rit-item';
                const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
                const detailsHTML = rit.details ? String(rit.details).replace(/\n/g, '<br>') : 'Geen';
                ritDiv.innerHTML = `<h5>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h5><p><strong>Door:</strong> ${rit.naam_oproeper || 'Onbekend'}</p><p><strong>Datum:</strong> ${vertrekDatum}</p><p><strong>Details:</strong> ${detailsHTML}</p><p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>`;
                container.appendChild(ritDiv);
            });
        }
    }

    async function renderBeheerWeergave(editToken) {
        // ... (De rest van de functies blijven hetzelfde als in uw originele bestand)
    }

    // ... (De rest van de event listeners blijven hetzelfde)
}