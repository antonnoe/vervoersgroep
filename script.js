// Constanten SUPABASE_URL en SUPABASE_KEY blijven hetzelfde

async function laadRitten() {
    const rittenLijstDiv = document.getElementById('ritten-lijst');
    rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';

    try {
        // ... (fetch call blijft hetzelfde) ...
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ritten?select=*&status=eq.actief&order=created_at.desc`, { headers: { /* ... */ } });
        if (!response.ok) { throw new Error(`Fout bij het ophalen van data: ${response.statusText}`); }
        
        const data = await response.json();
        
        // **** NIEUWE FILTER CODE ****
        const vandaag = new Date();
        vandaag.setHours(0, 0, 0, 0); // Zet tijd op middernacht voor een eerlijke vergelijking

        // We filteren de resultaten: toon alleen ritten die recent zijn of in de toekomst liggen.
        // We staan een marge van 7 dagen in het verleden toe.
        const filteredData = data.filter(rit => {
            const vertrekDatum = new Date(rit.vertrekdatum);
            const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
            return dagenVerschil <= 7;
        });

        rittenLijstDiv.innerHTML = ''; 

        if (filteredData.length === 0) {
            rittenLijstDiv.innerHTML = '<p>Er zijn op dit moment geen actieve oproepen.</p>';
        } else {
            // We gebruiken nu 'filteredData' om de lijst op te bouwen
            filteredData.forEach(rit => {
                // ... (de rest van de forEach loop blijft exact hetzelfde) ...
                const ritDiv = document.createElement('div');
                ritDiv.className = 'rit-item';
                const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
                ritDiv.innerHTML = `<h3>${rit.type.replace('_', ' ')}</h3><p><strong>Van:</strong> ${rit.van_plaats}</p><p><strong>Naar:</strong> ${rit.naar_plaats}</p><p><strong>Datum:</strong> ${vertrekDatum}</p><p><strong>Details:</strong> ${rit.details || 'Geen details opgegeven'}</p><p><strong>Contact:</strong> <a href="${rit.contact_info}" target="_blank" rel="noopener noreferrer">Neem contact op</a></p>`;
                rittenLijstDiv.appendChild(ritDiv);
            });
        }
    } catch (error) { /* ... (error handling blijft hetzelfde) ... */ }
}

// De voegRitToe functie en de event listeners blijven ongewijzigd.
// ... (rest van script.js) ...