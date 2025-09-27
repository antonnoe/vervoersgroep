document.addEventListener('DOMContentLoaded', function() {
    const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSN4dKR5-eO0UYvzsIhUFRoAETbFRQHmoSzhYDY5Ljer5ebt1dJFk1EuCGFt1w01FyYbX37kZGg4H-t/pub?gid=1598670068&single=true&output=csv';
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxr0IID6SNXKzrH0gMXTN2qEWmLnIx-iDRAr0KiBkDT8c43Rli4EIPaBUuf_LLewUgCnQ/exec';

    const editForm = document.getElementById('edit-form');
    const loadingMessage = document.getElementById('loading-message');
    const urlParams = new URLSearchParams(window.location.search);
    const editToken = urlParams.get('edit');

    function parseCSV(text) {
        // ... (deze functie is hetzelfde als in script.js)
    }

    async function laadOproepData() {
        if (!editToken) {
            loadingMessage.innerHTML = '<p style="color:red;">Fout: Geen bewerk-token gevonden.</p>';
            return;
        }
        try {
            const response = await fetch(`${GOOGLE_SHEET_URL}&timestamp=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Kon de data niet ophalen.');
            const csvText = await response.text();
            const allData = parseCSV(csvText);
            const rit = allData.find(r => r.edit_token === editToken);
            if (!rit) throw new Error('Oproep niet gevonden of ongeldige link.');
            
            // Vul alle formuliervelden in
            editForm.elements['type'].value = rit.type;
            editForm.elements['naam_oproeper'].value = rit.naam_oproeper;
            editForm.elements['van_plaats'].value = rit.van_plaats;
            editForm.elements['naar_plaats'].value = rit.naar_plaats;
            editForm.elements['vertrekdatum'].value = rit.vertrekdatum;
            editForm.elements['details'].value = rit.details;
            editForm.elements['contact_info'].value = rit.contact_info;
            
            loadingMessage.style.display = 'none';
            editForm.style.display = 'block';

        } catch (error) {
            loadingMessage.innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }

    editForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(editForm);
        const updatedData = Object.fromEntries(formData.entries());
        updatedData.edit_token = editToken;
        updatedData.action = 'update';

        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify(updatedData)
            });
            alert('Je oproep is succesvol bijgewerkt!');
            window.location.href = 'index.html';
        } catch (error) {
            alert(`Er is een fout opgetreden bij het opslaan: ${error.message}`);
        }
    });

    laadOproepData();
});