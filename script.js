document.addEventListener('DOMContentLoaded', function() {
    const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';
    const rittenLijstDiv = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    let supabaseClient;
    try {
        const { createClient } = supabase;
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (error) {
        console.error('Supabase library is niet geladen:', error);
        rittenLijstDiv.innerHTML = '<p style="color:red;">Kritieke fout: de Supabase-bibliotheek kon niet worden geladen.</p>';
        return;
    }

    async function laadRitten() {
        rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('edit');
        try {
            const { data, error } = await supabaseClient.from('ritten').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            const vandaag = new Date();
            vandaag.setHours(0, 0, 0, 0);
            const filteredData = data.filter(rit => {
                const vertrekDatum = new Date(rit.vertrekdatum);
                const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
                return dagenVerschil <= 7;
            });
            rittenLijstDiv.innerHTML = '';
            if (filteredData.length === 0) {
                rittenLijstDiv.innerHTML = '<p>Er zijn op dit moment geen actieve oproepen.</p>';
            } else {
                filteredData.forEach(rit => {
                    const ritDiv = document.createElement('div');
                    ritDiv.className = 'rit-item';
                    const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
                    let ritHTML = `<h3>${rit.type.replace(/_/g, ' ')}</h3><p><strong>Van:</strong> ${rit.van_plaats}</p><p><strong>Naar:</strong> ${rit.naar_plaats}</p><p><strong>Datum:</strong> ${vertrekDatum}</p><p><strong>Details:</strong> ${rit.details || 'Geen details opgegeven'}</p><p><strong>Contact:</strong> ${rit.contact_info}</p>`;
                    if (editToken && editToken === rit.edit_token) {
                        ritHTML += `<hr><button class="delete-button" data-id="${rit.id}">Verwijder deze oproep</button>`;
                    }
                    ritDiv.innerHTML = ritHTML;
                    rittenLijstDiv.appendChild(ritDiv);
                });
            }
        } catch (error) {
            console.error('Fout bij laden:', error);
            rittenLijstDiv.innerHTML = `<p style="color:red; font-weight: bold;">Fout bij het laden van ritten:</p><pre>${error.message}</pre>`;
        }
    }

    vervoerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(vervoerForm);
        const ritData = Object.fromEntries(formData.entries());
        try {
            // **** DE CORRECTIE ZIT HIER ****
            // We voegen een 'Preference' header toe om de data terug te vragen.
            const { data, error } = await supabaseClient
                .from('ritten')
                .insert([ritData])
                .select()
                .single();

            if (error) throw error;

            const newEditToken = data.edit_token;
            const editUrl = `${window.location.origin}${window.location.pathname}?edit=${newEditToken}`;
            
            alert(`Je oproep is succesvol geplaatst!\n\nBELANGRIJK:\nBewaar de volgende geheime link om je oproep later te kunnen verwijderen:\n\n${editUrl}`);
            
            vervoerForm.reset();
            laadRitten();
        } catch (error) {
            console.error('Fout bij plaatsen:', error);
            alert(`Helaas is er een technische fout opgetreden bij het plaatsen:\n\n${error.message}`);
        }
    });

    rittenLijstDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-button')) {
            if (confirm('Weet je zeker dat je deze oproep wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
                const ritId = event.target.dataset.id;
                const { error } = await supabaseClient.from('ritten').delete().match({ id: ritId });
                if (error) {
                    alert(`Fout bij verwijderen: ${error.message}`);
                } else {
                    alert('Oproep succesvol verwijderd.');
                    window.location.href = `${window.location.origin}${window.location.pathname}`;
                }
            }
        }
    });

    laadRitten();
});