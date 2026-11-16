import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'responseMessage';
export const DEFAULT_RESPONSE_MESSAGE = 'Success';

/** Mensaje de la respuesta exitosa. Sin el decorador se usa "Success". */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
