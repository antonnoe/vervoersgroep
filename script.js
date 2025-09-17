document.addEventListener('DOMContentLoaded', function() {
    const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    const rittenLijstDiv = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    const successModal = document.getElementById('success-modal');

    async function laadRitten() {
        rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('edit');

        // --- DIAGNOSTISCHE REGEL 1 ---
        // Laat ons zien welke sleutel de code uit de URL leest.
        console.log('Sleutel uit URL:', editToken);

        try {
            const { data, error } = await supabaseClient.from('ritten').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            
            // ... (filteren op datum blijft hetzelfde) ...
            const vandaag = new Date();
            vandaag.setHours(0, 0, 0, 0);
            const activeData = data.filter(rit => {
                const vertrekDatum = new Date(rit.vertrekdatum);
                const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
                return dagenVerschil <= 3;
            });

            // ... (groeperen blijft hetzelfde) ...
            const groepen = { vraag_lift: [], aanbod_lift: [], vraag_transport: [], aanbod_transport: [] };
            activeData.forEach(rit => groepen[rit.type]?.push(rit));
            rittenLijstDiv.innerHTML = ''; 
            const weergaveOrde = [ /* ... */ ];
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
                        // --- DIAGNOSTISCHE REGEL 2 ---
                        // Laat ons de sleutel van elke oproep in de database zien.
                        console.log(`Sleutel in database voor oproep ${rit.id}:`, rit.edit_token);

                        const ritDiv = document.createElement('div');
                        ritDiv.className = 'rit-item';
                        // ... (HTML opbouw blijft hetzelfde) ...
                        let ritHTML = `...`; 

                        // De controle die nu niet werkt
                        if (editToken && editToken === rit.edit_token) {
                            ritHTML += `<hr><button class="delete-button" data-id="${rit.id}">Verwijder deze oproep</button>`;
                        }
                        ritDiv.innerHTML = ritHTML;
                        targetKolom.appendChild(ritDiv);
                    });
                }
            });

            if (!contentGevonden) { /* ... */ }

        } catch (error) { /* ... */ }
    }

    // De rest van het script (vervoerForm, event listeners, etc.) blijft ongewijzigd.
    // Voor de zekerheid hieronder de volledige, correcte code:

    vervoerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(vervoerForm);
        const ritData = Object.fromEntries(formData.entries());
        try {
            const { data, error } = await supabaseClient.from('ritten').insert([ritData]).select().single();
            if (error) throw error;
            document.getElementById('modal-text').textContent = "Je oproep is geplaatst! Een e-mail met een link om je oproep te beheren is (onderweg) naar je toe gestuurd. Deze oproep wordt automatisch verwijderd 3 dagen na de door u opgegeven datum.";
            successModal.style.display = 'block';
            vervoerForm.reset();
            laadRitten();
        } catch (error) {
            alert(`Fout bij plaatsen: ${error.message}`);
        }
    });
    document.getElementById('modal-ok-button').addEventListener('click', () => { window.location.href = 'https://www.nederlanders.fr/'; });
    document.getElementById('modal-new-button').addEventListener('click', () => { successModal.style.display = 'none'; vervoerForm.scrollIntoView({ behavior: 'smooth' }); });
    rittenLijstDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-button')) {
            if (confirm('Weet je zeker dat je deze oproep wilt verwijderen?')) {
                const ritId = event.target.dataset.id;
                const { error } = await supabaseClient.from('ritten').delete().match({ id: ritId });
                if (error) {
                    alert(`Fout bij verwijderen: ${error.message}`);
                } else {
                    alert('Oproep succesvol verwijderd.');
                    window.location.href = window.location.pathname;
                }
            }
        }
    });

    laadRitten();
});