import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { getPaginatedResult, getPaginationHeaders } from './paginationHelper';
import { Message } from '../_models/message';
import { BehaviorSubject, Observable } from 'rxjs';
import { PaginatedResult } from '../_models/pagination';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { User } from '../_models/user';
import { take } from 'rxjs/operators';
import { Group } from '../_models/group';
import { BusyService } from './busy.service';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  baseUrl = environment.apiUrl;
  hubUrl = environment.hubUrl;
  private hubConnection: HubConnection;
  private messageThreadSource = new BehaviorSubject<Message[]>([]);
  messageThread$ = this.messageThreadSource.asObservable();

  constructor(private http: HttpClient, private busyService: BusyService) {
  }

  createHubConnection(user: User, otherUsername: string): void {
    this.busyService.busy();
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.hubUrl + 'message?user=' + otherUsername, {
        accessTokenFactory: () => user.token
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .catch(error => {
        console.log(error);
      })
      .finally(() => {
        this.busyService.idle();
      });

    this.hubConnection.on('ReceiveMessageThread', messages => {
      this.messageThreadSource.next(messages);
    });

    this.hubConnection.on('NewMessage', message => {
      this.messageThread$.pipe(take(1)).subscribe(messages => {
        this.messageThreadSource.next([...messages, message]);
      });
    });

    this.hubConnection.on('UpdatedGroup', (group: Group) => {
      if (group.connections.some(x => x.username === otherUsername)) {
        this.messageThread$.pipe(take(1)).subscribe(messages => {
          messages.forEach(message => {
            if (!message.dateRead) {
              message.dateRead = new Date(Date.now());
            }
          });
          this.messageThreadSource.next([...messages]);
        });
      }
    });
  }

  stopHubConnection(): void {
    if (this.hubConnection) {
      this.messageThreadSource.next([]);
      this.hubConnection.stop();
    }
  }

  getMessages(pageNumber: number, pageSize: number, container: string): Observable<PaginatedResult<Message[]>> {
    let params = getPaginationHeaders(pageNumber, pageSize);
    params = params.append('Container', container);
    return getPaginatedResult<Message[]>(this.baseUrl + 'messages', params, this.http);
  }

  getMessageThread(username: string): Observable<Message[]> {
    return this.http.get<Message[]>(this.baseUrl + 'messages/thread/' + username);
  }

  async sendMessage(username: string, content: string): Promise<any> {
    return this.hubConnection.invoke('SendMessage', { recipientUsername: username, content })
      .catch(error => console.log(error));
  }

  deleteMessage(id: number): Observable<void> {
    return this.http.delete<void>(this.baseUrl + 'messages/' + id);
  }
}
