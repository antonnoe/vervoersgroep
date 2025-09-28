document.addEventListener('DOMContentLoaded', function() {
    // --- DEZE URL IS NU 100% CORRECT ---
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx1bATQlNIu7vTY1VFIX98zfznYk86vZ2C3WUo2-CcazWdzPOquahzgCmBJKBUwnpOFKw/exec';

    const editForm = document.getElementById('edit-form');
    const loadingMessage = document.getElementById('loading-message');
    const urlParams = new URLSearchParams(window.location.search);
    const editToken = urlParams.get('edit');

    async function laadOproepData() {
        if (!editToken) {
            loadingMessage.innerHTML = '<p style="color:red;">Fout: Geen bewerk-token gevonden.</p>';
            return;
        }
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?timestamp=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Kon de data niet ophalen.');
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);

            const allData = result.data;
            const rit = allData.find(r => r.edit_token === editToken);
            if (!rit) throw new Error('Oproep niet gevonden of ongeldige link.');
            
            editForm.elements['type'].value = rit.type;
            editForm.elements['naam_oproeper'].value = rit.naam_oproeper;
            editForm.elements['van_plaats'].value = rit.van_plaats;
            editForm.elements['naar_plaats'].value = rit.naar_plaats;
            // Zorg ervoor dat de datum correct wordt geformatteerd voor het input veld
            editForm.elements['vertrekdatum'].value = new Date(rit.vertrekdatum).toISOString().split('T')[0];
            editForm.elements['details'].value = rit.details;
            editForm.elements['contact_info'].value = rit.contact_info;
            
            loadingMessage.style.display = 'none';
            editForm.style.display = 'block';

        } catch (error) {
            loadingMessage.innerHTML = `<p style="color:red;">Fout: ${error.message}</p>`;
        }
    }

    editForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const submitButton = editForm.querySelector('button[type="submit"]');
        submitButton.textContent = 'Opslaan...';
        submitButton.disabled = true;

        const formData = new FormData(editForm);
        const updatedData = Object.fromEntries(formData.entries());
        updatedData.edit_token = editToken;
        updatedData.action = 'update';

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(updatedData)
            });
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);

            alert('Je oproep is succesvol bijgewerkt!');
            window.location.href = 'index.html';
        } catch (error) {
            alert(`Er is een fout opgetreden bij het opslaan: ${error.message}`);
            submitButton.textContent = 'Wijzigingen Opslaan';
            submitButton.disabled = false;
        }
    });

    laadOproepData();
});