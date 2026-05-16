require('dotenv').config();
const supabase = require('./config/supabase');

async function testQuery() {
    const { data, error } = await supabase
        .from('bipol_tracker')
        .select('*')
        .eq('bus_id', 'SIM-UI-01')
        .order('created_at', { ascending: false })
        .limit(5);
        
    console.log("Error:", error);
    console.log("Data length:", data ? data.length : 0);
    if (data && data.length > 0) {
        console.log("Sample:", data[0]);
    }
}

testQuery();
