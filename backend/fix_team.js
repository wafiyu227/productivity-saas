import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixUser() {
    const userId = '5b0e9815-02d5-45fa-ad84-781e74626114';

    console.log('Checking profile for user:', userId);
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return;
    }

    console.log('Current Profile:', profile);

    if (!profile.team_id) {
        console.log('User has no team. Creating one...');

        const { data: team, error: teamError } = await supabase
            .from('teams')
            .insert({
                name: "Ibrahim's Team",
                size_range: '1-10'
            })
            .select()
            .single();

        if (teamError) {
            console.error('Error creating team:', teamError);
            return;
        }

        console.log('Created team:', team);

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ team_id: team.id })
            .eq('id', userId);

        if (updateError) {
            console.error('Error linking user to team:', updateError);
        } else {
            console.log('Successfully linked user to team!');
        }
    } else {
        console.log('User is already in a team:', profile.team_id);
    }
}

fixUser();
