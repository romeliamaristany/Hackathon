import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins/admin';
import { adminAc, userAc } from 'better-auth/plugins/admin/access';
import { Pool } from 'pg';

/**
 * Roles del sistema. Se guardan tal cual en `user.role`.
 * El valor por defecto es PARTICIPANT y solo un ADMIN puede cambiarlo.
 */
export const ROLE = {
  PARTICIPANT: 'PARTICIPANT',
  ADMIN: 'ADMIN',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

/**
 * Pool de `pg` propio de Better Auth (Prisma 8 no tiene adaptador oficial).
 * Se crea aquí, fuera de la inyección de dependencias, porque la CLI de
 * Better Auth y AuthModule.forRoot necesitan una instancia ya construida.
 * Lo cierra AuthDatabaseLifecycle al apagar la app.
 */
export const authPool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3001';

const googleClientId = process.env['GOOGLE_CLIENT_ID'];
const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];

export const auth = betterAuth({
  database: authPool,
  trustedOrigins: [frontendUrl],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  // Google solo se activa cuando las credenciales existen en el entorno.
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24, // se renueva como máximo una vez al día
  },
  plugins: [
    admin({
      // El campo `role` del plugin tiene `input: false`: no se puede enviar
      // en el sign up, solo lo cambia un ADMIN desde /api/auth/admin/*.
      defaultRole: ROLE.PARTICIPANT,
      adminRoles: [ROLE.ADMIN],
      roles: {
        [ROLE.ADMIN]: adminAc,
        [ROLE.PARTICIPANT]: userAc,
      },
    }),
  ],
});
