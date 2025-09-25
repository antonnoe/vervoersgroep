document.addEventListener('DOMContentLoaded', function() {
    // URL van je gepubliceerde Google Sheet CSV
    const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSN4dKR5-eO0UYvzsIhUFRoAETbFRQHmoSzhYDY5Ljer5ebt1dJFk1EuCGFt1w01FyYbX37kZGg4H-t/pub?gid=1598670068&single=true&output=csv';
    const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/624843/u11gttx/';

    const rittenLijstContainer = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    const successModal = document.getElementById('success-modal');
    const hoofdTitel = document.querySelector('h2#hoofdTitel');

    // Functie om de CSV data van Google Sheets te parsen
    function parseCSV(text) {
        const rows = text.trim().split(/\r?\n/);
        const headers = rows[0].split(',');
        return rows.slice(1).map(row => {
            const values = row.split(',');
            return headers.reduce((object, header, index) => {
                object[header.trim()] = values[index] ? values[index].trim() : '';
                return object;
            }, {});
        });
    }

    async function laadPagina() {
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('edit');

        if (editToken) {
            // De beheer-weergave bouwen we hierna
            await renderBeheerWeergave(editToken);
        } else {
            await renderAlleRitten();
        }
    }

    async function renderAlleRitten() {
        rittenLijstContainer.innerHTML = '<p>Ritten worden geladen...</p>';
        try {
            const response = await fetch(GOOGLE_SHEET_URL);
            if (!response.ok) throw new Error('Kon de data niet ophalen uit de spreadsheet.');
            
            const csvText = await response.text();
            let data = parseCSV(csvText);
            
            data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const vandaag = new Date();
            vandaag.setHours(0, 0, 0, 0);
            const activeData = data.filter(rit => {
                if (!rit.vertrekdatum) return false;
                const vertrekDatum = new Date(rit.vertrekdatum);
                const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
                return dagenVerschil <= 3;
            });

            const groepen = {
                vraag_lift: [], aanbod_lift: [],
                vraag_transport: [], aanbod_transport: []
            };
            activeData.forEach(rit => groepen[rit.type]?.push(rit));
            
            // Bouw de basis HTML-structuur opnieuw op
            rittenLijstContainer.innerHTML = `
                <h3 class="full-width-titel" id="liftcentrale">LIFTCENTRALE</h3>
                <div class="category-container">
                    <div class="category-column">
                        <h4 id="lift-aanvragen">Liftaanvragen</h4>
                        <div id="vraag_lift_list"></div>
                    </div>
                    <div class="category-column">
                        <h4 id="lift-aanbod">Liftaanbod</h4>
                        <div id="aanbod_lift_list"></div>
                    </div>
                </div>
                <h3 class="full-width-titel" id="transportcentrale">TRANSPORTCENTRALE</h3>
                <div class="category-container">
                    <div class="category-column">
                        <h4 id="transport-aanvragen">Transportaanvragen</h4>
                        <div id="vraag_transport_list"></div>
                    </div>
                    <div class="category-column">
                        <h4 id="transport-aanbod">Transportaanbod</h4>
                        <div id="aanbod_transport_list"></div>
                    </div>
                </div>
            `;
            
            // Vind nu de containers die we zojuist hebben aangemaakt
            const vraagLiftList = document.getElementById('vraag_lift_list');
            const aanbodLiftList = document.getElementById('aanbod_lift_list');
            const vraagTransportList = document.getElementById('vraag_transport_list');
            const aanbodTransportList = document.getElementById('aanbod_transport_list');
            
            // Vul de lijsten met de juiste data
            renderGroep(groepen.vraag_lift, vraagLiftList);
            renderGroep(groepen.aanbod_lift, aanbodLiftList);
            renderGroep(groepen.vraag_transport, vraagTransportList);
            renderGroep(groepen.aanbod_transport, aanbodTransportList);

        } catch (error) {
            console.error('Fout bij laden:', error);
            rittenLijstContainer.innerHTML = `<p style="color:red;">Fout: ${error.message}</p>`;
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
                ritDiv.innerHTML = `
                    <h5>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h5>
                    <p><strong>Door:</strong> ${rit.naam_oproeper || 'Onbekend'}</p>
                    <p><strong>Datum:</strong> ${vertrekDatum}</p>
                    <p><strong>Details:</strong> ${rit.details || 'Geen'}</p>
                    <p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>
                `;
                container.appendChild(ritDiv);
            });
        }
    }

    async function renderBeheerWeergave(editToken) {
        // Logica voor bewerken komt hier later
    }

    vervoerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(vervoerForm);
        const ritData = Object.fromEntries(formData.entries());

        ritData.id = new Date().getTime().toString();
        ritData.created_at = new Date().toISOString();
        ritData.edit_token = crypto.randomUUID();

        try {
            const response = await fetch(ZAPIER_WEBHOOK_URL, {
                method: 'POST',
                body: JSON.stringify(ritData)
            });
            if (!response.ok) throw new Error('Er is een fout opgetreden bij het versturen van de data.');

            document.getElementById('modal-text').textContent = "Je oproep is geplaatst! Een e-mail met een link om je oproep te beheren is onderweg naar je toe gestuurd.";
            successModal.style.display = 'block';
            vervoerForm.reset();
            
        } catch (error) {
            console.error('Fout bij plaatsen:', error);
            alert(`Helaas is er een technische fout opgetreden:\n\n${error.message}`);
        }
    });

    document.getElementById('modal-ok-button').addEventListener('click', () => { window.location.href = 'https://www.nederlanders.fr/'; });
    document.getElementById('modal-new-button').addEventListener('click', () => { 
        successModal.style.display = 'none'; 
        vervoerForm.scrollIntoView({ behavior: 'smooth' });
    });

    laadPagina();
});