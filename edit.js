document.addEventListener('DOMContentLoaded', function() {
    const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    const editForm = document.getElementById('edit-form');
    const loadingMessage = document.getElementById('loading-message');
    const urlParams = new URLSearchParams(window.location.search);
    const editToken = urlParams.get('edit');
    let ritId = null; // Variabele om het ID van de rit te bewaren

    async function laadOproepData() {
        if (!editToken) {
            loadingMessage.innerHTML = '<p style="color:red;">Fout: Geen bewerk-token gevonden. Ga terug naar de hoofdpagina.</p>';
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
            
            ritId = data.id; // Bewaar het ID voor de update-functie

            // Vul alle formuliervelden in
            editForm.elements['type'].value = data.type;
            editForm.elements['naam_oproeper'].value = data.naam_oproeper;
            editForm.elements['van_plaats'].value = data.van_plaats;
            editForm.elements['naar_plaats'].value = data.naar_plaats;
            editForm.elements['vertrekdatum'].value = data.vertrekdatum;
            editForm.elements['details'].value = data.details;
            editForm.elements['contact_info'].value = data.contact_info;
            
            loadingMessage.style.display = 'none';
            editForm.style.display = 'block';

        } catch (error) {
            console.error('Fout:', error);
            loadingMessage.innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }

    // Functie om de wijzigingen op te slaan
    editForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const formData = new FormData(editForm);
        const updatedData = Object.fromEntries(formData.entries());

        try {
            const { error } = await supabaseClient
                .from('ritten')
                .update(updatedData)
                .eq('id', ritId); // Update de rij met het juiste ID

            if (error) throw error;

            alert('Je oproep is succesvol bijgewerkt!');
            window.location.href = 'index.html'; // Stuur terug naar de hoofdpagina

        } catch (error) {
            console.error('Update Fout:', error);
            alert(`Er is een fout opgetreden bij het opslaan: ${error.message}`);
        }
    });

    laadOproepData();
});