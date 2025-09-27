document.addEventListener('DOMContentLoaded', function() {
    const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSN4dKR5-eO0UYvzsIhUFRoAETbFRQHmoSzhYDY5Ljer5ebt1dJFk1EuCGFt1w01FyYbX37kZGg4H-t/pub?gid=1598670068&single=true&output=csv';
    // **** DEZE REGEL WAS PER ONGELUK VERWIJDERD EN IS NU TERUG ****
    const ZAPIER_INSERT_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/624843/u11gttx/';
    const GOOGLE_SCRIPT_DELETE_URL = 'https://script.google.com/macros/s/AKfycbxr0IID6SNXKzrH0gMXTN2qEWmLnIx-iDRAr0KiBkDT8c43Rli4EIPaBUuf_LLewUgCnQ/exec';

    const rittenLijstContainer = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    const successModal = document.getElementById('success-modal');
    const hoofdTitel = document.querySelector('h2#hoofdTitel');

    function parseCSV(text) {
        const rows = text.trim().split(/\r?\n/);
        const headers = rows[0].split(',');
        return rows.slice(1).filter(row => row && row.split(',')[0].trim() !== '').map(row => {
            const values = row.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
            return headers.reduce((object, header, index) => {
                const value = values[index] ? values[index].replace(/^"|"$/g, '') : '';
                object[header.trim()] = value.trim();
                return object;
            }, {});
        });
    }

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
            const response = await fetch(`${GOOGLE_SHEET_URL}&timestamp=${new Date().getTime()}`);
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
            const groepen = { vraag_lift: [], aanbod_lift: [], vraag_transport: [], aanbod_transport: [] };
            activeData.forEach(rit => groepen[rit.type]?.push(rit));
            rittenLijstContainer.innerHTML = `
                <h3 class="full-width-titel" id="liftcentrale">LIFTCENTRALE</h3>
                <div class="category-container">
                    <div class="category-column"><h4 id="lift-aanvragen">Liftaanvragen</h4><div id="vraag_lift_list"></div></div>
                    <div class="category-column"><h4 id="lift-aanbod">Liftaanbod</h4><div id="aanbod_lift_list"></div></div>
                </div>
                <h3 class="full-width-titel" id="transportcentrale">TRANSPORTCENTRALE</h3>
                <div class="category-container">
                    <div class="category-column"><h4 id="transport-aanvragen">Transportaanvragen</h4><div id="vraag_transport_list"></div></div>
                    <div class="category-column"><h4 id="transport-aanbod">Transportaanbod</h4><div id="aanbod_transport_list"></div></div>
                </div>
            `;
            renderGroep(groepen.vraag_lift, document.getElementById('vraag_lift_list'));
            renderGroep(groepen.aanbod_lift, document.getElementById('aanbod_lift_list'));
            renderGroep(groepen.vraag_transport, document.getElementById('vraag_transport_list'));
            renderGroep(groepen.aanbod_transport, document.getElementById('aanbod_transport_list'));
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
                ritDiv.innerHTML = `<h5>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h5><p><strong>Door:</strong> ${rit.naam_oproeper || 'Onbekend'}</p><p><strong>Datum:</strong> ${vertrekDatum}</p><p><strong>Details:</strong> ${rit.details || 'Geen'}</p><p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>`;
                container.appendChild(ritDiv);
            });
        }
    }

    async function renderBeheerWeergave(editToken) {
        try {
            const response = await fetch(`${GOOGLE_SHEET_URL}&timestamp=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Kon de data niet ophalen uit de spreadsheet.');
            const csvText = await response.text();
            const allData = parseCSV(csvText);
            const rit = allData.find(r => r.edit_token === editToken);
            if (!rit) throw new Error("Oproep niet gevonden of ongeldige link.");
            
            vervoerForm.style.display = 'none';
            document.querySelector('.nav-buttons').style.display = 'none';
            document.querySelector('hr').style.display = 'none';
            hoofdTitel.textContent = 'Beheer Je Oproep';
            rittenLijstContainer.innerHTML = ''; 
            
            const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
            const editUrl = `edit.html?edit=${rit.edit_token}`;
            
            const beheerDiv = document.createElement('div');
            beheerDiv.className = 'rit-item beheer-item';
            beheerDiv.innerHTML = `
                <h4>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h4>
                <p><strong>Door:</strong> ${rit.naam_oproeper}</p><p><strong>Datum:</strong> ${vertrekDatum}</p>
                <p><strong>Details:</strong> ${rit.details}</p><p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>
                <hr>
                <div class="beheer-knoppen">
                    <a href="${editUrl}" class="edit-button">Pas oproep aan</a>
                    <button class="delete-button" data-token="${rit.edit_token}">Verwijder oproep</button>
                </div>
            `;
            rittenLijstContainer.appendChild(beheerDiv);
        } catch (error) {
            console.error('Fout bij laden beheer-item:', error);
            rittenLijstContainer.innerHTML = `<p style="color:red;">Fout: ${error.message}</p>`;
        }
    }

    vervoerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(vervoerForm);
        const ritData = Object.fromEntries(formData.entries());
        ritData.id = new Date().getTime().toString();
        ritData.created_at = new Date().toISOString();
        ritData.edit_token = crypto.randomUUID();
        try {
            const response = await fetch(ZAPIER_INSERT_WEBHOOK, { method: 'POST', body: JSON.stringify(ritData) });
            if (!response.ok) throw new Error('Er is een fout opgetreden bij het versturen van de data.');
            document.getElementById('modal-text').textContent = "Je oproep is geplaatst! Een e-mail met een link om je oproep te beheren is onderweg naar je toe gestuurd.";
            successModal.style.display = 'block';
            vervoerForm.reset();
        } catch (error) {
            console.error('Fout bij plaatsen:', error);
            alert(`Helaas is er een technische fout opgetreden:\n\n${error.message}`);
        }
    });

    rittenLijstContainer.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-button')) {
            const button = event.target;
            const editToken = button.dataset.token;
            if (confirm('Weet je zeker dat je deze oproep definitief wilt verwijderen?')) {
                try {
                    await fetch(GOOGLE_SCRIPT_DELETE_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: {'Content-Type': 'text/plain;charset=utf-8'},
                        body: JSON.stringify({ edit_token: editToken })
                    });
                    alert('De oproep is succesvol verwijderd! De lijst wordt opnieuw geladen.');
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Fout bij verwijderen:', error);
                    alert(`Er is een fout opgetreden bij het verwijderen.`);
                }
            }
        }
    });

    document.getElementById('modal-ok-button').addEventListener('click', () => { window.location.href = 'https://www.nederlanders.fr/'; });
    document.getElementById('modal-new-button').addEventListener('click', () => { 
        successModal.style.display = 'none'; 
        vervoerForm.scrollIntoView({ behavior: 'smooth' });
    });

    laadPagina();
});