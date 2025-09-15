const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';

const rittenLijstDiv = document.getElementById('ritten-lijst');
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Functie om de ritten te laden, te filteren en weer te geven
 */
async function laadRitten() {
    rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';

    // Haal de 'edit_token' uit de URL, als die er is
    const urlParams = new URLSearchParams(window.location.search);
    const editToken = urlParams.get('edit');

    try {
        const { data, error } = await supabaseClient
            .from('ritten')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Filter 1: Verberg advertenties die ouder zijn dan 7 dagen
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
                
                let ritHTML = `
                    <h3>${rit.type.replace('_', ' ')}</h3>
                    <p><strong>Van:</strong> ${rit.van_plaats}</p>
                    <p><strong>Naar:</strong> ${rit.naar_plaats}</p>
                    <p><strong>Datum:</strong> ${vertrekDatum}</p>
                    <p><strong>Details:</strong> ${rit.details || 'Geen details opgegeven'}</p>
                    <p><strong>Contact:</strong> ${rit.contact_info}</p>
                `;

                // Filter 2: Toon een 'Verwijder'-knop als de edit_token overeenkomt
                if (editToken && editToken === rit.edit_token) {
                    ritHTML += `<hr><button class="delete-button" data-id="${rit.id}">Verwijder deze oproep</button>`;
                }

                ritDiv.innerHTML = ritHTML;
                rittenLijstDiv.appendChild(ritDiv);
            });
        }
    } catch (error) {
        console.error('Fout bij laden:', error);
        rittenLijstDiv.innerHTML = `<p style="color:red;">Fout bij het laden van ritten: ${error.message}</p>`;
    }
}

/**
 * Functie om een nieuwe rit toe te voegen
 */
document.getElementById('vervoer-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const ritData = Object.fromEntries(formData.entries());

    // De 'edit_token' wordt automatisch door de database gegenereerd (gen_random_uuid())
    
    // We moeten de data terugvragen om de nieuwe edit_token te krijgen
    const { data, error } = await supabaseClient
        .from('ritten')
        .insert([ritData])
        .select()
        .single(); // .single() om één object terug te krijgen i.p.v. een array

    if (error) {
        alert(`Fout bij plaatsen oproep: ${error.message}`);
    } else {
        const newEditToken = data.edit_token;
        const editUrl = `${window.location.origin}${window.location.pathname}?edit=${newEditToken}`;
        
        // Toon de geheime link aan de gebruiker
        alert(`Je oproep is succesvol geplaatst!\n\nBELANGRIJK:\nBewaar de volgende geheime link om je oproep later te kunnen verwijderen:\n\n${editUrl}`);
        
        form.reset();
        laadRitten();
    }
});

/**
 * Functie om een rit te verwijderen
 */
rittenLijstDiv.addEventListener('click', async (event) => {
    if (event.target.classList.contains('delete-button')) {
        if (confirm('Weet je zeker dat je deze oproep wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
            const ritId = event.target.dataset.id;
            const { error } = await supabaseClient.from('ritten').delete().match({ id: ritId });
            
            if (error) {
                alert(`Fout bij verwijderen: ${error.message}`);
            } else {
                alert('Oproep succesvol verwijderd.');
                // Verwijder de ?edit=... uit de URL en herlaad de pagina
                window.location.href = `${window.location.