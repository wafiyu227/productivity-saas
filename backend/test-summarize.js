import { db } from './api/services/supabase-client.js';
import aiProcessor from './api/services/ai-processor.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const messages = [
      { text: "I am totally stuck on the database migration.", user: "U123", ts: "12345" }
    ];
    
    console.log('Generating AI Analysis...');
    const aiAnalysis = await aiProcessor.summarizeSlackMessages(messages, 'test-channel');
    console.log('AI Analysis:', aiAnalysis);

    console.log('Saving to DB...');
    const savedSummary = await db.saveSlackSummary({
      user_id: 'test-user-id',
      channel_id: 'test-channel-id',
      channel_name: 'test-channel',
      team_id: 'test-team-id',
      summary: aiAnalysis.summary,
      blockers: aiAnalysis.blockers,
      key_topics: aiAnalysis.keyTopics,
      message_count: messages.length,
      time_period_start: new Date().toISOString(),
      time_period_end: new Date().toISOString()
    });

    console.log('Saved Summary:', savedSummary);
    
    if (aiAnalysis.blockers && aiAnalysis.blockers.length > 0) {
      console.log('Triggering alert...');
      const { default: slackService } = await import('./api/services/slack-service.js');
      const alertResponse = await slackService.sendBlockerAlert('test-user-id', 'test-channel-id', aiAnalysis.blockers, null);
      console.log('Alert Response:', alertResponse);
    }
  } catch (error) {
    console.error('Test Error:', error);
  }
}

test();
