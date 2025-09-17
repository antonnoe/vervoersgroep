document.addEventListener('DOMContentLoaded', function() {
    const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    const rittenLijstDiv = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    const successModal = document.getElementById('success-modal');
    const hoofdTitel = document.querySelector('h2#hoofdTitel'); // Zorg dat de H2 een ID heeft

    async function laadRitten() {
        rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('edit');

        try {
            // Als er een editToken in de URL staat, laden we alleen die ene rit
            if (editToken) {
                const { data, error } = await supabaseClient.from('ritten').select('*').eq('edit_token', editToken).single();
                if (error || !data) throw new Error("Oproep niet gevonden of ongeldige link.");
                
                vervoerForm.style.display = 'none'; // Verberg het standaard formulier
                document.querySelector('hr').style.display = 'none';
                document.querySelector('h2#hoofdTitel').textContent = 'Beheer Je Oproep';
                
                rittenLijstDiv.innerHTML = ''; // Maak de lijst leeg
                renderBeheerItem(data); // Toon de beheer-tegel
            } else {
                // Anders, laad alle ritten zoals normaal
                renderAlleRitten();
            }
        } catch (error) {
            console.error('Fout bij laden:', error);
            rittenLijstDiv.innerHTML = `<p style="color:red;">Fout: ${error.message}</p>`;
        }
    }

    // Aparte functie om alle ritten te tonen
    async function renderAlleRitten() {
        const { data, error } = await supabaseClient.from('ritten').select('*').order('created_at', { ascending: false });
        if (error) throw error;
            
        // ... (De rest van deze functie is hetzelfde als voorheen: filteren, groeperen, 2 kolommen, etc.)
        const vandaag = new Date();
        vandaag.setHours(0, 0, 0, 0);
        const activeData = data.filter(rit => {
            const vertrekDatum = new Date(rit.vertrekdatum);
            const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
            return dagenVerschil <= 3;
        });
        const groepen = { vraag_lift: [], aanbod_lift: [], vraag_transport: [], aanbod_transport: [] };
        activeData.forEach(rit => groepen[rit.type]?.push(rit));
        rittenLijstDiv.innerHTML = ''; 
        const weergaveOrde = [
            { key: 'vraag_lift', titel: 'Liftcentrale - Gevraagd' },
            { key: 'aanbod_lift', titel: 'Liftcentrale - Aangeboden' },
            { key: 'vraag_transport', titel: 'Transportcentrale - Gevraagd' },
            { key: 'aanbod_transport', titel: 'Transportcentrale - Aangeboden' }
        ];
        let contentGevonden = false;
        const kolom1 = document.createElement('div');
        const kolom2 = document.createElement('div');
        rittenLijstDiv.appendChild(kolom1);
        rittenLijstDiv.appendChild(kolom2);
        weergaveOrde.forEach((groepInfo, index) => {
            const groepData = groepen[groepInfo.key];
            const targetKolom = (index < 2) ? kolom1 : kolom2;
            if (groepData.length > 0) {
                contentGevonden = true;
                const titel = document.createElement('h3');
                titel.className = 'rit-group-titel';
                titel.textContent = groepInfo.titel;
                targetKolom.appendChild(titel);
                groepData.forEach(rit => {
                    const ritDiv = document.createElement('div');
                    ritDiv.className = 'rit-item';
                    const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
                    ritDiv.innerHTML = `<h4>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h4><p><strong>Door:</strong> ${rit.naam_oproeper || 'Onbekend'}</p><p><strong>Datum:</strong> ${vertrekDatum}</p><p><strong>Details:</strong> ${rit.details || 'Geen'}</p><p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>`;
                    targetKolom.appendChild(ritDiv);
                });
            }
        });
        if (!contentGevonden) {
            rittenLijstDiv.innerHTML = '<p style="grid-column: 1 / -1;">Er zijn op dit moment geen actieve oproepen.</p>';
        }
    }

    // Functie om de speciale beheer-tegel te tonen
    function renderBeheerItem(rit) {
        const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
        rittenLijstDiv.innerHTML = `
            <div class="rit-item beheer-item">
                <h4>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h4>
                <p><strong>Door:</strong> ${rit.naam_oproeper}</p>
                <p><strong>Datum:</strong> ${vertrekDatum}</p>
                <p><strong>Details:</strong> ${rit.details}</p>
                <p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>
                <hr>
                <p><strong>Acties:</strong></p>
                <button class="delete-button" data-id="${rit.id}">Definitief Verwijderen</button>
                <button class="edit-button" disabled>Bewerken (binnenkort beschikbaar)</button>
            </div>
        `;
    }

    // De 'submit' functie blijft grotendeels hetzelfde
    vervoerForm.addEventListener('submit', async (event) => { /* ... */ });

    // De 'delete' functie wordt aangepast
    rittenLijstDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-button')) {
            if (confirm('Weet je zeker dat je deze oproep definitief wilt verwijderen?')) {
                const ritId = event.target.dataset.id;
                const { error } = await supabaseClient.from('ritten').delete().match({ id: ritId });
                if (error) {
                    alert(`Fout bij verwijderen: ${error.message}`);
                } else {
                    alert('Oproep succesvol verwijderd.');
                    window.location.href = window.location.pathname; // Terug naar de hoofdpagina
                }
            }
        }
    });

    // Andere event listeners blijven hetzelfde
    document.getElementById('modal-ok-button').addEventListener('click', () => { window.location.href = 'https://www.nederlanders.fr/'; });
    document.getElementById('modal-new-button').addEventListener('click', () => { successModal.style.display = 'none'; vervoerForm.scrollIntoView({ behavior: 'smooth' }); });

    laadRitten();
});