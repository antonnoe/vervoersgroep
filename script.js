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

        try {
            const { data, error } = await supabaseClient.from('ritten').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            
            const vandaag = new Date();
            vandaag.setHours(0, 0, 0, 0);
            const activeData = data.filter(rit => {
                const vertrekDatum = new Date(rit.vertrekdatum);
                const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
                return dagenVerschil <= 3;
            });

            const groepen = {
                vraag_lift: [], aanbod_lift: [],
                vraag_transport: [], aanbod_transport: []
            };
            activeData.forEach(rit => groepen[rit.type]?.push(rit));

            rittenLijstDiv.innerHTML = ''; 

            const weergaveOrde = [
                { key: 'vraag_lift', titel: 'Liftcentrale - Gevraagd' },
                { key: 'aanbod_lift', titel: 'Liftcentrale - Aangeboden' },
                { key: 'vraag_transport', titel: 'Transportcentrale - Gevraagd' },
                { key: 'aanbod_transport', titel: 'Transportcentrale - Aangeboden' }
            ];
            
            let contentGevonden = false;
            // Maak kolommen voor de groepen
            const kolom1 = document.createElement('div');
            const kolom2 = document.createElement('div');
            rittenLijstDiv.appendChild(kolom1);
            rittenLijstDiv.appendChild(kolom2);

            weergaveOrde.forEach((groepInfo, index) => {
                const groepData = groepen[groepInfo.key];
                const targetKolom = (index < 2) ? kolom1 : kolom2; // Eerste 2 groepen in kolom 1, rest in kolom 2

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
                        
                        let ritHTML = `
                            <h4>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h4>
                            <p><strong>Door:</strong> ${rit.naam_oproeper || 'Onbekend'}</p>
                            <p><strong>Datum:</strong> ${vertrekDatum}</p>
                            <p><strong>Details:</strong> ${rit.details || 'Geen'}</p>
                            <p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>
                        `;

                        if (editToken && editToken === rit.edit_token) {
                            ritHTML += `<hr><button class="delete-button" data-id="${rit.id}">Verwijder deze oproep</button>`;
                        }
                        ritDiv.innerHTML = ritHTML;
                        targetKolom.appendChild(ritDiv);
                    });
                }
            });

            if (!contentGevonden) {
                rittenLijstDiv.innerHTML = '<p style="grid-column: 1 / -1;">Er zijn op dit moment geen actieve oproepen.</p>';
            }

        } catch (error) {
            console.error('Fout bij laden:', error);
            rittenLijstDiv.innerHTML = `<p style="color:red; grid-column: 1 / -1;">Fout: ${error.message}</p>`;
        }
    }

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

    document.getElementById('modal-ok-button').addEventListener('click', () => {
        window.location.href = 'https://www.nederlanders.fr/';
    });
    document.getElementById('modal-new-button').addEventListener('click', () => {
        successModal.style.display = 'none';
        vervoerForm.scrollIntoView({ behavior: 'smooth' });
    });

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