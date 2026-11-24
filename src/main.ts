import "./ui/style.css";
import { mount } from "./ui/app";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) mount(app);
