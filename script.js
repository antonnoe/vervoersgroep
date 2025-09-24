document.addEventListener('DOMContentLoaded', function() {
    // We laten de Supabase client hier nog even staan voor het laden van de ritten
    const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    const rittenLijstContainer = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    const successModal = document.getElementById('success-modal');
    const hoofdTitel = document.querySelector('h2#hoofdTitel');

    // De laadRitten functie blijft voor nu ongewijzigd
    async function laadPagina() {
        // ... (deze functie blijft voor nu hetzelfde)
    }
    // ... (alle laad- en render-functies blijven voor nu hetzelfde)

    // **** DIT IS DE BELANGRIJKSTE WIJZIGING ****
    vervoerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(vervoerForm);
        const ritData = Object.fromEntries(formData.entries());

        // Voeg de extra velden toe die de spreadsheet verwacht
        ritData.id = new Date().getTime(); // Simpel uniek ID
        ritData.created_at = new Date().toISOString();
        ritData.edit_token = crypto.randomUUID();

        try {
            // Stuur de data naar de Zapier Webhook URL
            const response = await fetch('https://hooks.zapier.com/hooks/catch/624843/u11gttx/', {
                method: 'POST',
                body: JSON.stringify(ritData)
            });

            if (!response.ok) {
                throw new Error('Er is een fout opgetreden bij het versturen van de data.');
            }

            // Toon de succes-pop-up (de e-mail wordt nu door Zapier verstuurd)
            document.getElementById('modal-text').textContent = "Je oproep is geplaatst! Een e-mail met een link om je oproep te beheren is onderweg naar je toe gestuurd.";
            successModal.style.display = 'block';
            
            vervoerForm.reset();
            // We laden de lijst nog niet opnieuw, dat doen we in de volgende fase

        } catch (error) {
            console.error('Fout bij plaatsen:', error);
            alert(`Helaas is er een technische fout opgetreden bij het plaatsen:\n\n${error.message}`);
        }
    });

    // De rest van de event listeners blijven voor nu ongewijzigd
    document.getElementById('modal-ok-button').addEventListener('click', () => { window.location.href = 'https://www.nederlanders.fr/'; });
    document.getElementById('modal-new-button').addEventListener('click', () => { successModal.style.display = 'none'; vervoerForm.scrollIntoView({ behavior: 'smooth' }); });
    rittenLijstContainer.addEventListener('click', async (event) => { /* ... (blijft ongewijzigd) */ });

    // laadPagina(); // We laden de pagina nog even niet automatisch
    rittenLijstContainer.innerHTML = '<p>Testfase: Rittenlijst is tijdelijk uitgeschakeld.</p>';
});