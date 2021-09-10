export const environment = {
  production: true,
  mailer: {
    host: 'ai-mail.ai-mail.svc.cluster.local',
    port: '25',
    from: process.env.MAILER_FROM || '"Aitheon" <no-reply@aitheon.com>',
    auth: {
      user: process.env.MAILER_EMAIL_ID || 'testuser',
      pass: process.env.MAILER_PASSWORD || '9j8js7pi37a4'
    },
    tls: {
      rejectUnauthorized: false
    }
  },
  authURI: `http://ai-auth.ai-auth.svc.cluster.local:${ process.env.AI_AUTH_SERVICE_PORT || 3000 }`,
  rabbitmq: {
    uri: process.env.RABBITMQ_URI || `amqp://ai-rabbit:Ne&ZTeFeYCqqQRK3s7qF@ai-rabbitmq.ai-rabbitmq.svc.cluster.local:5672`
  }
};