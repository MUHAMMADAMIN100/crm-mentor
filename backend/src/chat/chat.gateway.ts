import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private jwt: JwtService, private chat: ChatService) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string) || (client.handshake.query?.token as string);
      if (!token) return client.disconnect();
      const payload: any = await this.jwt.verifyAsync(token);
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('chat:join')
  join(@MessageBody() chatId: string, @ConnectedSocket() client: Socket) {
    client.join(`chat:${chatId}`);
  }

  @SubscribeMessage('chat:send')
  async send(
    @MessageBody() body: { chatId: string; text?: string; kind?: string; fileUrl?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    const msg = await this.chat.sendMessage(userId, body.chatId, body);
    this.server.to(`chat:${body.chatId}`).emit('chat:message', msg);
    return msg;
  }
}
