const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';

// Functie om ritten te laden (ongewijzigd)
async function laadRitten() {
    // ... (deze functie blijft exact hetzelfde als voorheen) ...
    const rittenLijstDiv = document.getElementById('ritten-lijst');
    rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ritten?select=*&status=eq.actief&order=created_at.desc`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
        if (!response.ok) { throw new Error(`Fout bij het ophalen van data: ${response.statusText}`); }
        const data = await response.json();
        rittenLijstDiv.innerHTML = ''; 
        if (data.length === 0) { rittenLijstDiv.innerHTML = '<p>Er zijn op dit moment geen actieve oproepen.</p>'; }
        else {
            data.forEach(rit => {
                const ritDiv = document.createElement('div');
                ritDiv.className = 'rit-item';
                const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
                ritDiv.innerHTML = `<h3>${rit.type.replace('_', ' ')}</h3><p><strong>Van:</strong> ${rit.van_plaats}</p><p><strong>Naar:</strong> ${rit.naar_plaats}</p><p><strong>Datum:</strong> ${vertrekDatum}</p><p><strong>Details:</strong> ${rit.details || 'Geen details opgegeven'}</p><p><strong>Contact:</strong> <a href="${rit.contact_info}" target="_blank" rel="noopener noreferrer">Neem contact op</a></p>`;
                rittenLijstDiv.appendChild(ritDiv);
            });
        }
    } catch (error) { console.error('Er is een fout opgetreden:', error); rittenLijstDiv.innerHTML = '<p>Er is een fout opgetreden bij het laden van de ritten. Probeer het later opnieuw.</p>'; }
}

// Functie om ritten toe te voegen (ongewijzigd)
async function voegRitToe(event) {
    // ... (deze functie blijft exact hetzelfde als voorheen) ...
    event.preventDefault(); 
    const form = event.target;
    const formData = new FormData(form);
    const ritData = Object.fromEntries(formData.entries());
    ritData.status = 'actief'; 
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ritten`, { method: 'POST', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify(ritData) });
        if (!response.ok) { throw new Error(`Fout bij het opslaan van de data: ${response.statusText}`); }
        form.reset();
        alert('Je oproep is succesvol geplaatst!');
        laadRitten();
    } catch (error) { console.error('Er is een fout opgetreden:', error); alert('Er is een fout opgetreden bij het plaatsen van je oproep. Probeer het later opnieuw.'); }
}

// Event listeners worden uitgevoerd als de pagina klaar is
document.addEventListener('DOMContentLoaded', function() {
    laadRitten();
    document.getElementById('vervoer-form').addEventListener('submit', voegRitToe);

    // **** AANGEPASTE CODE VOOR DE NIEUWE POP-UP ****
    const modal = document.getElementById('help-modal');
    const helpButton = document.getElementById('help-button');
    const closeButton = document.querySelector('.close-button');

    // Toon de modal als op de help-knop wordt geklikt
    helpButton.onclick = function() {
        modal.style.display = 'block';
    }

    // Verberg de modal als op de sluitknop (x) wordt geklikt
    closeButton.onclick = function() {
        modal.style.display = 'none';
    }

    // Verberg de modal als buiten de content-box wordt geklikt
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
});