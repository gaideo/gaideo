import { User } from "./user";

export interface Profile {
    UserIdentifier: string
    User: User
    Avatar: string
    Friend: User[]
}