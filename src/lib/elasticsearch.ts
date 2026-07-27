import { Client } from '@elastic/elasticsearch';

// Elasticsearch Client Initialization
// Ensure ELASTICSEARCH_URL is set in .env.local
const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  },
});

export default elasticClient;

export const INDEX_NAMES = {
  USERS: 'webreport-users',
  FORM_TEMPLATES: 'webreport-form-templates',
  SUBMISSIONS: 'webreport-submissions',
};
