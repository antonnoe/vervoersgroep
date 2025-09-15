// ****** Deze code is 100% compleet en klaar voor gebruik ******
const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';

// --- Vanaf hier hoef je niets te wijzigen ---

/**
 * Functie om alle actieve ritten op te halen uit de Supabase database
 * en deze op de pagina weer te geven.
 */
async function laadRitten() {
    const rittenLijstDiv = document.getElementById('ritten-lijst');
    rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';

    try {
        // Roep de Supabase API aan om de 'ritten' tabel te lezen
        // We selecteren alleen de ritten met de status 'actief' en sorteren op de nieuwste eerst.
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ritten?select=*&status=eq.actief&order=created_at.desc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!response.ok) {
            throw new Error(`Fout bij het ophalen van data: ${response.statusText}`);
        }

        const data = await response.json();

        // Maak de lijst leeg voordat we de nieuwe items toevoegen
        rittenLijstDiv.innerHTML = ''; 

        if (data.length === 0) {
            rittenLijstDiv.innerHTML = '<p>Er zijn op dit moment geen actieve oproepen.</p>';
        } else {
            // Loop door elke rit en maak een HTML-element aan
            data.forEach(rit => {
                const ritDiv = document.createElement('div');
                ritDiv.className = 'rit-item'; // Gebruik className voor compatibiliteit
                
                // Formatteer de datum netjes naar dd-mm-jjjj
                const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');

                // Maak de HTML-structuur voor de rit
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
 * De functie voegt een nieuwe rit toe aan de Supabase database.
 */
async function voegRitToe(event) {
    event.preventDefault(); // Voorkom dat de pagina herlaadt na het submitten

    const form = event.target;
    const formData = new FormData(form);
    const ritData = Object.fromEntries(formData.entries());
    ritData.status = 'actief'; // Zet de standaard status op 'actief'

    try {
        // Roep de Supabase API aan om een nieuwe rit in de tabel te schrijven
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ritten`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal' // We hoeven de data niet terug te krijgen
            },
            body: JSON.stringify(ritData)
        });

        if (!response.ok) {
            throw new Error(`Fout bij het opslaan van de data: ${response.statusText}`);
        }

        form.reset(); // Maak het formulier leeg na succesvolle invoer
        alert('Je oproep is succesvol geplaatst!');
        laadRitten(); // Herlaad de lijst met ritten zodat de nieuwe oproep zichtbaar wordt

    } catch (error) {
        console.error('Er is een fout opgetreden:', error);
        alert('Er is een fout opgetreden bij het plaatsen van je oproep. Probeer het later opnieuw.');
    }
}

// Koppel de functies aan de HTML elementen
// 'DOMContentLoaded' zorgt ervoor dat de code pas wordt uitgevoerd als de hele pagina geladen is.
document.addEventListener('DOMContentLoaded', laadRitten);
document.getElementById('vervoer-form').addEventListener('submit', voegRitToe);