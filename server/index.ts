'use strict';
import 'ts-helpers';
import 'reflect-metadata';
import { Container } from 'typedi';
import { environment } from './environment';
Container.set('environment', environment);
import { Application } from './config/application';

export default new Application();
