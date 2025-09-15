// ****** Deze code is 100% compleet en klaar voor gebruik ******
const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';

// --- Vanaf hier hoef je niets te wijzigen ---

/**
 * Functie om alle actieve ritten op te halen uit de Supabase database
 * en deze op de pagina weer te geven.
 */
async function laadRitten() {
    // ... (deze functie blijft exact hetzelfde als voorheen) ...
    const rittenLijstDiv = document.getElementById('ritten-lijst');
    rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ritten?select=*&status=eq.actief&order=created_at.desc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) { throw new Error(`Fout bij het ophalen van data: ${response.statusText}`); }
        const data = await response.json();
        rittenLijstDiv.innerHTML = ''; 
        if (data.length === 0) {
            rittenLijstDiv.innerHTML = '<p>Er zijn op dit moment geen actieve oproepen.</p>';
        } else {
            data.forEach(rit => {
                const ritDiv = document.createElement('div');
                ritDiv.className = 'rit-item';
                const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
                ritDiv.innerHTML = `
                    <h3>${rit.type.replace('_', ' ')}</h3>
                    <p><strong>Van:</strong> ${rit.van_plaats}</p>
                    <p><strong>Naar:</strong> ${rit.naar_plaats}</p>
                    <p><strong>Datum:</strong> ${vertrekDatum}</p>
                    <p><strong>Details:</strong> ${rit.details || 'Geen details opgegeven'}</p>
                    <p><strong>Contact:</strong> <a href="${rit.contact_info}" target="_blank" rel="noopener noreferrer">Neem contact op</a></p>
                `;
                rittenLijstDiv.appendChild(ritDiv);
            });
        }
    } catch (error) {
        console.error('Er is een fout opgetreden:', error);
        rittenLijstDiv.innerHTML = '<p>Er is een fout opgetreden bij het laden van de ritten. Probeer het later opnieuw.</p>';
    }
}

/**
 * Functie die wordt aangeroepen wanneer het formulier wordt ingediend.
 */
async function voegRitToe(event) {
    // ... (deze functie blijft exact hetzelfde als voorheen) ...
    event.preventDefault(); 
    const form = event.target;
    const formData = new FormData(form);
    const ritData = Object.fromEntries(formData.entries());
    ritData.status = 'actief'; 
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ritten`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(ritData)
        });
        if (!response.ok) { throw new Error(`Fout bij het opslaan van de data: ${response.statusText}`); }
        form.reset();
        alert('Je oproep is succesvol geplaatst!');
        laadRitten();
    } catch (error) {
        console.error('Er is een fout opgetreden:', error);
        alert('Er is een fout opgetreden bij het plaatsen van je oproep. Probeer het later opnieuw.');
    }
}

// Koppel de functies aan de HTML elementen
document.addEventListener('DOMContentLoaded', function() {
    laadRitten(); // Laad de ritten als de pagina klaar is

    // Koppel de submit functie aan het formulier
    document.getElementById('vervoer-form').addEventListener('submit', voegRitToe);

    // **** DIT IS DE NIEUWE CODE ****
    // Koppel de help-functie aan de nieuwe knop
    document.getElementById('help-button').addEventListener('click', function() {
        alert('INSTRUCTIES:\n\n1. Ga naar je eigen profielpagina op de NING website.\n2. Kopieer de volledige URL uit de adresbalk van je browser.\n3. Plak die URL in het veld hiernaast.');
    });
});