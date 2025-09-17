document.addEventListener('DOMContentLoaded', function() {
    const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    const editForm = document.getElementById('edit-form');
    const loadingMessage = document.getElementById('loading-message');

    // Functie om de data op te halen en het formulier in te vullen
    async function laadOproepData() {
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('edit');

        if (!editToken) {
            loadingMessage.textContent = 'Fout: Geen bewerk-token gevonden. Ga terug naar de hoofdpagina.';
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from('ritten')
                .select('*')
                .eq('edit_token', editToken)
                .single();

            if (error || !data) {
                throw new Error('Oproep niet gevonden of ongeldige link.');
            }

            // Vul alle formuliervelden in met de opgehaalde data
            document.getElementById('naam_oproeper').value = data.naam_oproeper;
            document.getElementById('van_plaats').value = data.van_plaats;
            document.getElementById('naar_plaats').value = data.naar_plaats;
            document.getElementById('vertrekdatum').value = data.vertrekdatum;
            document.getElementById('details').value = data.details;
            document.getElementById('contact_info').value = data.contact_info;

            // Selecteer de juiste radio button
            document.querySelector(`input[name="type"][value="${data.type}"]`).checked = true;
            
            loadingMessage.style.display = 'none';
            editForm.style.display = 'block';

        } catch (error) {
            console.error('Fout:', error);
            loadingMessage.innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }

    laadOproepData();
});